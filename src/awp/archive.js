'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const {validateIr} = require('../ir/validate');

const AWP_MANIFEST = 'awp.json';
const IR_PATH = 'ir/project.json';
const MAX_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;

function isSafeEntryName(name) {
    return typeof name === 'string'
        && name.length > 0
        && !name.startsWith('/')
        && !name.includes('\\')
        && !name.split('/').includes('..');
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function findSignatureBackwards(buffer, signature) {
    for (let i = buffer.length - 22; i >= 0; i -= 1) {
        if (buffer.readUInt32LE(i) === signature) return i;
    }
    return -1;
}

function readCentralDirectory(archive) {
    const eocd = findSignatureBackwards(archive, 0x06054b50);
    if (eocd < 0 || eocd + 22 > archive.length) {
        throw new Error('AWP-ARCHIVE-001: ZIP end record is missing.');
    }
    const entryCount = archive.readUInt16LE(eocd + 10);
    const directorySize = archive.readUInt32LE(eocd + 12);
    const directoryOffset = archive.readUInt32LE(eocd + 16);
    if (directoryOffset + directorySize > archive.length) {
        throw new Error('AWP-ARCHIVE-002: central directory is out of bounds.');
    }
    const entries = [];
    let cursor = directoryOffset;
    for (let i = 0; i < entryCount; i += 1) {
        if (cursor + 46 > archive.length || archive.readUInt32LE(cursor) !== 0x02014b50) {
            throw new Error('AWP-ARCHIVE-003: malformed central directory.');
        }
        const method = archive.readUInt16LE(cursor + 10);
        const flags = archive.readUInt16LE(cursor + 8);
        const crc = archive.readUInt32LE(cursor + 16);
        const compressedSize = archive.readUInt32LE(cursor + 20);
        const size = archive.readUInt32LE(cursor + 24);
        const nameLength = archive.readUInt16LE(cursor + 28);
        const extraLength = archive.readUInt16LE(cursor + 30);
        const commentLength = archive.readUInt16LE(cursor + 32);
        const localOffset = archive.readUInt32LE(cursor + 42);
        const nameStart = cursor + 46;
        const name = archive.subarray(nameStart, nameStart + nameLength).toString('utf8');
        entries.push({name, method, flags, crc, compressedSize, size, localOffset});
        cursor = nameStart + nameLength + extraLength + commentLength;
    }
    return entries;
}

function readEntry(archive, entry) {
    if (!isSafeEntryName(entry.name)) {
        throw new Error(`AWP-ARCHIVE-004: unsafe entry path: ${entry.name}`);
    }
    if (entry.size > MAX_ENTRY_BYTES) {
        throw new Error(`AWP-ARCHIVE-005: entry exceeds ${MAX_ENTRY_BYTES} bytes: ${entry.name}`);
    }
    if ((entry.flags & 1) !== 0) {
        throw new Error(`AWP-ARCHIVE-006: encrypted entries are not supported: ${entry.name}`);
    }
    if (entry.localOffset + 30 > archive.length
        || archive.readUInt32LE(entry.localOffset) !== 0x04034b50) {
        throw new Error(`AWP-ARCHIVE-007: invalid local header: ${entry.name}`);
    }
    const nameLength = archive.readUInt16LE(entry.localOffset + 26);
    const extraLength = archive.readUInt16LE(entry.localOffset + 28);
    const start = entry.localOffset + 30 + nameLength + extraLength;
    const end = start + entry.compressedSize;
    if (end > archive.length) throw new Error(`AWP-ARCHIVE-008: entry is out of bounds: ${entry.name}`);
    const compressed = archive.subarray(start, end);
    let output;
    if (entry.method === 0) output = Buffer.from(compressed);
    else if (entry.method === 8) output = zlib.inflateRawSync(compressed, {maxOutputLength: MAX_ENTRY_BYTES});
    else throw new Error(`AWP-ARCHIVE-009: unsupported compression method: ${entry.method}`);
    if (output.length !== entry.size || crc32(output) !== entry.crc) {
        throw new Error(`AWP-ARCHIVE-010: CRC or size mismatch: ${entry.name}`);
    }
    return output;
}

function inspectArchive(archive) {
    if (!Buffer.isBuffer(archive)) throw new TypeError('archive must be a Buffer');
    if (archive.length > MAX_ARCHIVE_BYTES) throw new Error(`AWP-ARCHIVE-011: archive exceeds ${MAX_ARCHIVE_BYTES} bytes`);
    const entries = readCentralDirectory(archive);
    const names = new Set();
    const files = new Map();
    for (const entry of entries) {
        const normalized = path.posix.normalize(entry.name);
        if (!isSafeEntryName(entry.name) || normalized !== entry.name || names.has(normalized)) {
            throw new Error(`AWP-ARCHIVE-012: unsafe or duplicate entry: ${entry.name}`);
        }
        names.add(normalized);
        files.set(normalized, readEntry(archive, entry));
    }
    return files;
}

function parseJson(files, name, code) {
    const content = files.get(name);
    if (!content) throw new Error(`${code}: missing ${name}`);
    try {
        return JSON.parse(content.toString('utf8'));
    } catch (error) {
        throw new Error(`${code}: invalid JSON in ${name}: ${error.message}`);
    }
}

function validateProject(manifest, ir) {
    if (manifest.format !== 'aprismwarp-project' || manifest.schemaVersion !== 1) {
        throw new Error('AWP-MANIFEST-001: unsupported AWP manifest.');
    }
    if (manifest.workType !== ir.workType) throw new Error('AWP-MANIFEST-002: workType does not match IR.');
    if (!manifest.workProfile || manifest.workProfile.workType !== manifest.workType) {
        throw new Error('AWP-MANIFEST-003: workProfile does not match workType.');
    }
    if (manifest.target?.minecraft !== manifest.workProfile.minecraftVersion
        || manifest.target?.aprism !== manifest.workProfile.aprismVersion) {
        throw new Error('AWP-MANIFEST-004: target and workProfile versions do not match.');
    }
    const irResult = validateIr(ir, {mode: 'export'});
    if (!irResult.valid) throw new Error(`AWP-IR-100: ${irResult.diagnostics.map(d => d.code).join(', ')}`);
}

/**
 * Reads and validates an AWP archive without executing any contained code.
 * @param {string} archivePath path to the .awp archive
 * @returns {{manifest: object, ir: object, files: Map<string, Buffer>}}
 */
function readAwp(archivePath) {
    const files = inspectArchive(fs.readFileSync(archivePath));
    const manifest = parseJson(files, AWP_MANIFEST, 'AWP-MANIFEST-000');
    const ir = parseJson(files, IR_PATH, 'AWP-IR-000');
    validateProject(manifest, ir);
    return {manifest, ir, files};
}

function dosTime() {
    return {date: 0x0021, time: 0};
}

function localHeader(name, data, offset) {
    const nameBytes = Buffer.from(name, 'utf8');
    const header = Buffer.alloc(30 + nameBytes.length);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    const stamp = dosTime();
    header.writeUInt16LE(stamp.time, 10);
    header.writeUInt16LE(stamp.date, 12);
    header.writeUInt32LE(crc32(data), 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(header, 30);
    return {header, data, nameBytes, offset};
}

function centralHeader(entry) {
    const header = Buffer.alloc(46 + entry.nameBytes.length);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    const stamp = dosTime();
    header.writeUInt16LE(stamp.time, 12);
    header.writeUInt16LE(stamp.date, 14);
    header.writeUInt32LE(crc32(entry.data), 16);
    header.writeUInt32LE(entry.data.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(entry.nameBytes.length, 28);
    header.writeUInt32LE(entry.offset, 42);
    entry.nameBytes.copy(header, 46);
    return header;
}

/**
 * Writes a deterministic stored AWP archive. Values are UTF-8 JSON or Buffers.
 * @param {string} archivePath destination path
 * @param {{manifest: object, ir: object, files?: Map<string, Buffer|Uint8Array>}} project project data
 */
function writeAwp(archivePath, project) {
    const manifest = project.manifest;
    const ir = project.ir;
    validateProject(manifest, ir);
    const values = new Map(project.files || []);
    values.set(AWP_MANIFEST, Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
    values.set(IR_PATH, Buffer.from(JSON.stringify(ir, null, 2) + '\n'));
    const names = [...values.keys()].sort();
    for (const name of names) {
        if (!isSafeEntryName(name) || path.posix.normalize(name) !== name) throw new Error(`AWP-ARCHIVE-012: unsafe entry: ${name}`);
    }
    const local = [];
    const central = [];
    let offset = 0;
    for (const name of names) {
        const entry = localHeader(name, Buffer.from(values.get(name)), offset);
        local.push(entry.header, entry.data);
        central.push(centralHeader(entry));
        offset += entry.header.length + entry.data.length;
    }
    const directory = Buffer.concat(central);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(names.length, 8);
    eocd.writeUInt16LE(names.length, 10);
    eocd.writeUInt32LE(directory.length, 12);
    eocd.writeUInt32LE(offset, 16);
    fs.mkdirSync(path.dirname(archivePath), {recursive: true});
    fs.writeFileSync(archivePath, Buffer.concat([...local, directory, eocd]));
}

module.exports = {inspectArchive, readAwp, writeAwp, MAX_ENTRY_BYTES, MAX_ARCHIVE_BYTES};
