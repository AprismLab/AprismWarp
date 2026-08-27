'use strict';

const fs = require('node:fs');
const zlib = require('node:zlib');

const EDITOR_MANIFEST = 'aprismwarp.editor.json';
const MAX_MANIFEST_BYTES = 1024 * 1024;
const SCHEMA = 'aprismwarp.aep-editor/v1';
const IDENTIFIER = /^[a-z][a-z0-9_-]{1,63}:[a-z][a-z0-9_-]{1,63}$/;
const WORK_TYPES = new Set(['AprismJEMod', 'AprismExtension']);
const SHAPES = new Set(['statement', 'reporter', 'hat']);
const IR_KINDS = new Set(['declaration', 'event', 'action', 'expression']);
const FIELD_TYPES = new Set(['string', 'number', 'boolean', 'resource-path', 'resource-key']);

/**
 * Reads the central directory of a ZIP without loading or executing any
 * embedded code. Supports the two methods emitted by ordinary ZIP writers:
 * stored (0) and raw deflate (8).
 *
 * @param {Buffer} archive complete ZIP bytes
 * @returns {Array<{name:string, method:number, compressedSize:number, size:number, localOffset:number}>}
 */
function readCentralDirectory(archive) {
    const eocd = findSignatureBackwards(archive, 0x06054b50);
    if (eocd < 0 || eocd + 22 > archive.length) {
        throw new Error('AEP-ARCHIVE-001: ZIP end record is missing.');
    }
    const entries = archive.readUInt16LE(eocd + 10);
    const directorySize = archive.readUInt32LE(eocd + 12);
    const directoryOffset = archive.readUInt32LE(eocd + 16);
    if (directoryOffset + directorySize > archive.length) {
        throw new Error('AEP-ARCHIVE-002: ZIP central directory is out of bounds.');
    }

    const result = [];
    let cursor = directoryOffset;
    for (let i = 0; i < entries; i += 1) {
        if (cursor + 46 > archive.length || archive.readUInt32LE(cursor) !== 0x02014b50) {
            throw new Error('AEP-ARCHIVE-003: malformed ZIP central directory.');
        }
        const method = archive.readUInt16LE(cursor + 10);
        const compressedSize = archive.readUInt32LE(cursor + 20);
        const size = archive.readUInt32LE(cursor + 24);
        const nameLength = archive.readUInt16LE(cursor + 28);
        const extraLength = archive.readUInt16LE(cursor + 30);
        const commentLength = archive.readUInt16LE(cursor + 32);
        const localOffset = archive.readUInt32LE(cursor + 42);
        const nameStart = cursor + 46;
        const name = archive.subarray(nameStart, nameStart + nameLength).toString('utf8');
        result.push({name, method, compressedSize, size, localOffset});
        cursor = nameStart + nameLength + extraLength + commentLength;
    }
    return result;
}

function findSignatureBackwards(buffer, signature) {
    for (let i = buffer.length - 22; i >= 0; i -= 1) {
        if (buffer.readUInt32LE(i) === signature) {
            return i;
        }
    }
    return -1;
}

function readEntry(archive, entry, maxOutputBytes = Number.MAX_SAFE_INTEGER) {
    if (entry.localOffset + 30 > archive.length
        || archive.readUInt32LE(entry.localOffset) !== 0x04034b50) {
        throw new Error(`AEP-ARCHIVE-004: local header is invalid for ${entry.name}.`);
    }
    const nameLength = archive.readUInt16LE(entry.localOffset + 26);
    const extraLength = archive.readUInt16LE(entry.localOffset + 28);
    const start = entry.localOffset + 30 + nameLength + extraLength;
    const end = start + entry.compressedSize;
    if (end > archive.length) {
        throw new Error(`AEP-ARCHIVE-005: entry is out of bounds: ${entry.name}.`);
    }
    const compressed = archive.subarray(start, end);
    if (entry.method === 0) {
        if (compressed.length > maxOutputBytes) {
            throw new Error(`AEP-EDITOR-013: editor manifest exceeds ${maxOutputBytes} bytes after extraction.`);
        }
        return Buffer.from(compressed);
    }
    if (entry.method === 8) {
        try {
            return zlib.inflateRawSync(compressed, {maxOutputLength: maxOutputBytes});
        } catch (error) {
            if (error.code === 'ERR_BUFFER_TOO_LARGE') {
                throw new Error(`AEP-EDITOR-013: editor manifest exceeds ${maxOutputBytes} bytes after extraction.`);
            }
            throw error;
        }
    }
    throw new Error(`AEP-ARCHIVE-006: unsupported ZIP compression method ${entry.method}.`);
}

function isSafeEntryName(name) {
    return name.length > 0
        && !name.startsWith('/')
        && !name.includes('\\')
        && !name.split('/').includes('..');
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateManifest(manifest) {
    const diagnostics = [];
    const error = (code, message) => diagnostics.push({code, severity: 'error', message});
    if (!isRecord(manifest) || manifest.schema !== SCHEMA) {
        error('AEP-EDITOR-001', `schema must be ${SCHEMA}.`);
        return diagnostics;
    }
    if (typeof manifest.extensionId !== 'string'
        || !/^[a-z][a-z0-9_-]{1,63}$/.test(manifest.extensionId)) {
        error('AEP-EDITOR-002', 'extensionId is invalid.');
    }
    if (!isRecord(manifest.requires)
        || typeof manifest.requires.aprismRange !== 'string'
        || !Array.isArray(manifest.requires.workTypes)
        || manifest.requires.workTypes.length === 0
        || manifest.requires.workTypes.some(type => !WORK_TYPES.has(type))) {
        error('AEP-EDITOR-003', 'requires must declare aprismRange and valid workTypes.');
    }
    if (!Array.isArray(manifest.capabilities)) {
        error('AEP-EDITOR-004', 'capabilities must be an array.');
        return diagnostics;
    }
    const capabilityIds = new Set();
    const blockIds = new Set();
    for (const capability of manifest.capabilities) {
        if (!isRecord(capability) || !IDENTIFIER.test(capability.id)
            || capability.kind !== 'block-catalog') {
            error('AEP-EDITOR-005', 'capability must be a namespaced block-catalog.');
            continue;
        }
        if (capabilityIds.has(capability.id)) {
            error('AEP-EDITOR-006', `duplicate capability id: ${capability.id}.`);
        }
        capabilityIds.add(capability.id);
        if (!Array.isArray(capability.blocks)) {
            error('AEP-EDITOR-007', `blocks must be an array: ${capability.id}.`);
            continue;
        }
        for (const block of capability.blocks) {
            if (!isRecord(block) || !IDENTIFIER.test(block.id)
                || typeof block.category !== 'string' || !block.category.trim()
                || !SHAPES.has(block.shape) || !IR_KINDS.has(block.irKind)
                || !IDENTIFIER.test(block.irOperation)) {
                error('AEP-EDITOR-008', `invalid block declaration in ${capability.id}.`);
                continue;
            }
            if (blockIds.has(block.id)) {
                error('AEP-EDITOR-009', `duplicate block id: ${block.id}.`);
            }
            blockIds.add(block.id);
            if (block.fields !== undefined && (!Array.isArray(block.fields)
                || block.fields.some(field => !isRecord(field)
                    || typeof field.id !== 'string' || !field.id.trim()
                    || !FIELD_TYPES.has(field.type)))) {
                error('AEP-EDITOR-010', `invalid block fields: ${block.id}.`);
            }
        }
    }
    return diagnostics;
}

/**
 * Inspects an AEP and returns a safe, declarative block catalog. The embedded
 * runtime jar is deliberately never opened or evaluated.
 *
 * @param {string} archivePath path to an .aep file
 * @returns {{valid:boolean, manifest:object|null, blocks:Array<object>, diagnostics:Array<object>, entries:Array<string>}}
 */
function inspectAep(archivePath) {
    const diagnostics = [];
    try {
        const archive = fs.readFileSync(archivePath);
        const entries = readCentralDirectory(archive);
        const names = entries.map(entry => entry.name);
        if (names.some(name => !isSafeEntryName(name))) {
            diagnostics.push({code: 'AEP-ARCHIVE-007', severity: 'error',
                message: 'archive contains an unsafe path entry.'});
        }
        const manifestEntry = entries.find(entry => entry.name === EDITOR_MANIFEST);
        if (!manifestEntry) {
            return {valid: diagnostics.length === 0, manifest: null, blocks: [], diagnostics,
                entries: names};
        }
        if (manifestEntry.size > MAX_MANIFEST_BYTES) {
            diagnostics.push({code: 'AEP-EDITOR-011', severity: 'error',
                message: `editor manifest exceeds ${MAX_MANIFEST_BYTES} bytes.`});
            return {valid: false, manifest: null, blocks: [], diagnostics, entries: names};
        }
        let manifest;
        try {
            manifest = JSON.parse(
                readEntry(archive, manifestEntry, MAX_MANIFEST_BYTES).toString('utf8')
            );
        } catch (error) {
            if (String(error.message).startsWith('AEP-EDITOR-013:')) {
                diagnostics.push({code: 'AEP-EDITOR-013', severity: 'error', message: error.message});
                return {valid: false, manifest: null, blocks: [], diagnostics, entries: names};
            }
            diagnostics.push({code: 'AEP-EDITOR-012', severity: 'error',
                message: `editor manifest is invalid JSON: ${error.message}`});
            return {valid: false, manifest: null, blocks: [], diagnostics, entries: names};
        }
        diagnostics.push(...validateManifest(manifest));
        const blocks = diagnostics.some(item => item.severity === 'error') ? []
            : manifest.capabilities.flatMap(capability => capability.blocks || []);
        return {valid: diagnostics.length === 0, manifest, blocks, diagnostics, entries: names};
    } catch (error) {
        diagnostics.push({code: 'AEP-ARCHIVE-000', severity: 'error', message: error.message});
        return {valid: false, manifest: null, blocks: [], diagnostics, entries: []};
    }
}

module.exports = {inspectAep, validateManifest, readCentralDirectory};
