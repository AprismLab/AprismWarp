'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const fs = require('node:fs');
const zlib = require('node:zlib');

const {validateFile} = require('../schema/validate');

const AWE_MANIFEST = 'aprismwarp.extension.json';
const SCHEMA = 'aprismwarp.extension/v1';
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_CONTRIB_BYTES = 1024 * 1024;
const KNOWN_PERMISSIONS = new Set([
    'editor.blocks', 'editor.panels', 'project.read', 'project.write',
    'compiler.adapter', 'host.mdl', 'host.language-server'
]);
const APPROVAL_REQUIRED = new Set(['host.mdl', 'compiler.adapter']);

let aweSchemaPath = null;

function configureAweSchemaPath(schemaPath) {
    aweSchemaPath = schemaPath;
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

function readCentralDirectory(archive) {
    const eocd = findSignatureBackwards(archive, 0x06054b50);
    if (eocd < 0 || eocd + 22 > archive.length) {
        throw new Error('AWE-ARCHIVE-001: ZIP end record is missing.');
    }
    const entries = archive.readUInt16LE(eocd + 10);
    const directorySize = archive.readUInt32LE(eocd + 12);
    const directoryOffset = archive.readUInt32LE(eocd + 16);
    if (directoryOffset + directorySize > archive.length) {
        throw new Error('AWE-ARCHIVE-002: ZIP central directory is out of bounds.');
    }
    const result = [];
    let cursor = directoryOffset;
    for (let i = 0; i < entries; i += 1) {
        if (cursor + 46 > archive.length || archive.readUInt32LE(cursor) !== 0x02014b50) {
            throw new Error('AWE-ARCHIVE-003: malformed ZIP central directory.');
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

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

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
        throw new Error(`AWE-ARCHIVE-004: local header is invalid for ${entry.name}.`);
    }
    const nameLength = archive.readUInt16LE(entry.localOffset + 26);
    const extraLength = archive.readUInt16LE(entry.localOffset + 28);
    const start = entry.localOffset + 30 + nameLength + extraLength;
    const end = start + entry.compressedSize;
    if (end > archive.length) {
        throw new Error(`AWE-ARCHIVE-005: entry is out of bounds: ${entry.name}.`);
    }
    const compressed = archive.subarray(start, end);
    if (entry.method === 0) {
        if (compressed.length > maxOutputBytes) {
            throw new Error(`AWE-ARCHIVE-008: entry exceeds ${maxOutputBytes} bytes: ${entry.name}.`);
        }
        return Buffer.from(compressed);
    }
    if (entry.method === 8) {
        try {
            return zlib.inflateRawSync(compressed, {maxOutputLength: maxOutputBytes});
        } catch (error) {
            if (error.code === 'ERR_BUFFER_TOO_LARGE') {
                throw new Error(`AWE-ARCHIVE-008: entry exceeds ${maxOutputBytes} bytes: ${entry.name}.`);
            }
            throw error;
        }
    }
    throw new Error(`AWE-ARCHIVE-006: unsupported ZIP compression method ${entry.method}.`);
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

function isSafeEntryName(name) {
    return name.length > 0
        && !name.startsWith('/')
        && !name.includes('\\')
        && !name.split('/').includes('..');
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJsonEntry(archive, entry, code, diagnostics) {
    if (entry.size > MAX_CONTRIB_BYTES) {
        diagnostics.push({code, severity: 'error',
            message: `${entry.name} exceeds ${MAX_CONTRIB_BYTES} bytes.`});
        return null;
    }
    try {
        return JSON.parse(readEntry(archive, entry, MAX_CONTRIB_BYTES).toString('utf8'));
    } catch (error) {
        diagnostics.push({code, severity: 'error',
            message: `${entry.name} could not be read: ${error.message}`});
        return null;
    }
}

function validateSemantics(manifest, entryNames, diagnostics) {
    const error = (code, message) => diagnostics.push({code, severity: 'error', message});
    const permissions = new Set(Array.isArray(manifest.permissions) ? manifest.permissions : []);
    const contributes = isRecord(manifest.contributes) ? manifest.contributes : {};

    if (contributes.blocks && !permissions.has('editor.blocks')) {
        error('AWE-MANIFEST-004', 'contributes.blocks requires the editor.blocks permission.');
    }
    if (Array.isArray(contributes.panels) && contributes.panels.length > 0
        && !permissions.has('editor.panels')) {
        error('AWE-MANIFEST-005', 'contributes.panels requires the editor.panels permission.');
    }
    for (const permission of permissions) {
        if (APPROVAL_REQUIRED.has(permission)) {
            diagnostics.push({code: 'AWE-MANIFEST-007', severity: 'info',
                message: `permission ${permission} requires explicit user approval at install time.`});
        }
    }

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

    if (contributes.blocks && !entryNames.includes(contributes.blocks)) {
        error('AWE-MANIFEST-006', `declared blocks file is missing: ${contributes.blocks}.`);
    }
    if (Array.isArray(contributes.panels)) {
        for (const panel of contributes.panels) {
            if (!entryNames.includes(panel)) {
                error('AWE-MANIFEST-006', `declared panel file is missing: ${panel}.`);
            }
        }
    }
    if (isRecord(manifest.runtime)) {
        diagnostics.push({code: 'AWE-MANIFEST-008', severity: 'warning',
            message: `trusted runtime code declared (${manifest.runtime.entry}); it is disabled by default and never executed during inspection.`});
    }
}

/**
 * Inspects an .awe editor extension. Data-only contributions are parsed and
 * validated; runtime/ code is never loaded or executed.
 *
 * @param {string} archivePath path to an .awe file
 * @returns {{valid:boolean, manifest:object|null, blocks:object|null,
 *   panels:Array<object>, runtimeEntry:string|null,
 *   diagnostics:Array<object>, entries:Array<string>}}
 */
function inspectAwe(archivePath) {
    const diagnostics = [];
    try {
        const archive = fs.readFileSync(archivePath);
        const entries = readCentralDirectory(archive);
        const names = entries.map(entry => entry.name);
        if (names.some(name => !isSafeEntryName(name))) {
            diagnostics.push({code: 'AWE-ARCHIVE-007', severity: 'error',
                message: 'archive contains an unsafe path entry.'});
        }

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

        const manifestEntry = entries.find(entry => entry.name === AWE_MANIFEST);
        if (!manifestEntry) {
            diagnostics.push({code: 'AWE-MANIFEST-001', severity: 'error',
                message: `required manifest is missing: ${AWE_MANIFEST}.`});
            return {valid: false, manifest: null, blocks: null, panels: [],
                runtimeEntry: null, diagnostics, entries: names};
        }
        if (manifestEntry.size > MAX_MANIFEST_BYTES) {
            diagnostics.push({code: 'AWE-MANIFEST-002', severity: 'error',
                message: `manifest exceeds ${MAX_MANIFEST_BYTES} bytes.`});
            return {valid: false, manifest: null, blocks: null, panels: [],
                runtimeEntry: null, diagnostics, entries: names};
        }
        let manifest;
        try {
            manifest = JSON.parse(
                readEntry(archive, manifestEntry, MAX_MANIFEST_BYTES).toString('utf8')
            );
        } catch (error) {
            diagnostics.push({code: 'AWE-MANIFEST-003', severity: 'error',
                message: `manifest is invalid JSON: ${error.message}`});
            return {valid: false, manifest: null, blocks: null, panels: [],
                runtimeEntry: null, diagnostics, entries: names};
        }

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

        if (isRecord(manifest) && manifest.schema !== SCHEMA) {
            diagnostics.push({code: 'AWE-MANIFEST-004', severity: 'error',
                message: `schema must be ${SCHEMA}.`});
            return {valid: false, manifest, blocks: null, panels: [],
                runtimeEntry: null, diagnostics, entries: names};
        }
        if (aweSchemaPath) {
            const schemaResult = validateFile(aweSchemaPath, manifest);
            if (!schemaResult.valid) {
                for (const item of schemaResult.errors) {
                    diagnostics.push({code: 'AWE-MANIFEST-009', severity: 'error',
                        message: `${item.path} ${item.code} ${item.message}`});
                }
            }
        }
        validateSemantics(manifest, names, diagnostics);

        const contributes = isRecord(manifest.contributes) ? manifest.contributes : {};
        const blocksEntry = typeof contributes.blocks === 'string'
            ? entries.find(entry => entry.name === contributes.blocks)
            : undefined;
        const blocks = blocksEntry ? readJsonEntry(archive, blocksEntry,
            'AWE-CONTRIB-001', diagnostics) : null;
        const panels = [];
        if (Array.isArray(contributes.panels)) {
            for (const panelName of contributes.panels) {
                const panelEntry = entries.find(entry => entry.name === panelName);
                if (panelEntry) {
                    const doc = readJsonEntry(archive, panelEntry,
                        'AWE-CONTRIB-002', diagnostics);
                    if (doc !== null) panels.push({file: panelName, doc});
                }
            }
        }

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

        const runtimeEntry = isRecord(manifest.runtime)
            && typeof manifest.runtime.entry === 'string'
            ? manifest.runtime.entry : null;
        if (runtimeEntry && !names.includes(runtimeEntry)) {
            diagnostics.push({code: 'AWE-MANIFEST-010', severity: 'error',
                message: `runtime entry is missing: ${runtimeEntry}.`});
        }
        return {valid: diagnostics.every(item => item.severity !== 'error'),
            manifest, blocks, panels, runtimeEntry, diagnostics, entries: names};
    } catch (error) {
        diagnostics.push({code: 'AWE-ARCHIVE-000', severity: 'error', message: error.message});
        return {valid: false, manifest: null, blocks: null, panels: [],
            runtimeEntry: null, diagnostics, entries: []};
    }
}

module.exports = {inspectAwe, configureAweSchemaPath, readCentralDirectory, validateSemantics};
