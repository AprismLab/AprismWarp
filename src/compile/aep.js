'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


const fs = require('node:fs');
const path = require('node:path');
const {readAwp, writeAwp} = require('../awp/archive');
const {buildExtensionManifest, validateExtensionManifest} = require('../extension/manifest');
const {sha256Hex, getAepLocks, verifyAepLock, applyAepLock} = require('../extension/lock');

const AEP_PATH = 'aprism.extension.json';
const JAR_PATH = 'build/extension.jar';
const EDITOR_MANIFEST_PATH = 'aprismwarp.editor.json';

/**
 * Reads an .awp project archive and returns the parsed editor metadata block.
 * Returns an empty object when the project has no `editor/project.json`
 * entry (editor state is optional for headless compilation).
 *
 * @param {string} awpPath path to the .awp archive
 * @returns {object} parsed editor metadata, never null
 */
function readEditorMetadata(awpPath) {
    const project = readAwp(awpPath);
    const editor = project.files.get('editor/project.json');
    if (!editor) return {manifest: project.manifest, ir: project.ir, files: project.files, extension: {}};
    try {
        return {
            manifest: project.manifest,
            ir: project.ir,
            files: project.files,
            extension: JSON.parse(editor.toString('utf8'))
        };
    } catch (error) {
        throw new Error(`AWP-EDITOR-001: editor/project.json is invalid JSON: ${error.message}`);
    }
}

/**
 * Assembles an Aprism extension archive (.aep) from an .awp project.
 *
 * The .awp project must be of workType `AprismExtension`, declare a fully
 * qualified Java entrypoint class in editor metadata, and embed a
 * pre-compiled extension JAR at `build/extension.jar`.
 *
 * @param {string} awpPath path to the source .awp archive
 * @param {string} aepPath destination path for the generated .aep
 * @param {object} [options] writer options
 * @param {Buffer} [options.extensionJar] override for the embedded extension JAR
 * @returns {{manifest: object, entries: string[]}} the generated manifest and entry list
 */
function generateAep(awpPath, aepPath, options = {}) {

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover



    const project = readEditorMetadata(awpPath);
    if (project.manifest.workType !== 'AprismExtension') {
        throw new Error(`AWP-COMPILE-001: .awp workType must be AprismExtension; got "${project.manifest.workType}".`);
    }
    const editor = project.extension || {};
    const entrypoint = String(editor.entrypoint || '').trim();
    if (!entrypoint) {
        throw new Error('AWP-COMPILE-002: editor metadata must declare `entrypoint` for AprismExtension projects.');
    }
    const displayName = String(editor.displayName || editor.name || project.manifest.name || '').trim();
    if (!displayName) {
        throw new Error('AWP-COMPILE-003: editor metadata must declare `displayName` for AprismExtension projects.');
    }
    const description = String(editor.description || '').trim();
    if (!description) {
        throw new Error('AWP-COMPILE-004: editor metadata must declare `description` for AprismExtension projects.');
    }
    const version = String(editor.version || '0.1.0').trim();

    const manifest = buildExtensionManifest({
        projectId: project.manifest.projectId,
        target: project.manifest.target,
        ir: project.ir,
        entrypoint,
        displayName,
        description,
        version
    });
    const validation = validateExtensionManifest(manifest);
    if (!validation.valid) {
        throw new Error('AWP-COMPILE-005: generated manifest failed validation: ' +
            validation.diagnostics.map(d => `${d.code}=${d.message}`).join('; '));
    }

    const jarEntry = options.extensionJar || project.files.get(JAR_PATH);
    if (!jarEntry) {
        throw new Error(`AWP-COMPILE-006: ${JAR_PATH} is required inside the .awp project.`);
    }
    if (!Buffer.isBuffer(jarEntry)) {
        throw new Error(`AWP-COMPILE-007: ${JAR_PATH} must be raw bytes.`);
    }
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

    const entries = {
        [AEP_PATH]: Buffer.from(JSON.stringify(manifest, null, 2) + '\n'),
        [JAR_PATH]: Buffer.from(jarEntry)
    };
    const editorCatalog = project.files.get(EDITOR_MANIFEST_PATH);
    if (editorCatalog) entries[EDITOR_MANIFEST_PATH] = Buffer.from(editorCatalog);

    const aepFiles = new Map(Object.entries(entries));


    writeAep(aepPath, aepFiles);
    return {manifest, entries: Object.keys(entries)};
}

/**
 * Compiles an .awp project to .aep and writes the resulting AEP hash back
 * into the project's `extensions.aepCapabilities` lock table. The .awp
 * archive is then re-serialised at `options.awpOutPath` (or the original
 * `awpPath` by default) with the updated lock.
 *
 * When `options.updateAwp` is `false` the AWP is read but not rewritten; the
 * caller receives the updated manifest in the result and is responsible for
 * any persistence. The default is `true`.
 *
 * @param {string} awpPath source .awp project archive
 * @param {string} aepPath destination path for the generated .aep
 * @param {object} [options]
 * @param {string} [options.awpOutPath] path to rewrite the .awp to
 * @param {boolean} [options.updateAwp=true] whether to rewrite the .awp
 * @param {string[]} [options.capabilities] capability ids to associate
 * @returns {{manifest: object, lock: object, aepPath: string, awpPath: string}}
 */
function generateAepAndLock(awpPath, aepPath, options = {}) {
    const updateAwp = options.updateAwp !== false;
    const awpOutPath = options.awpOutPath || awpPath;
    const project = readEditorMetadata(awpPath);
    const capabilityIds = collectCapabilityIds(project.files.get(EDITOR_MANIFEST_PATH));
    generateAep(awpPath, aepPath, options);

    const aepHash = sha256Hex(aepPath);
    const aepFiles = inspectAepEntries(aepPath);
    const extensionId = aepFiles && aepFiles.manifest ? aepFiles.manifest.extensionId : project.manifest.projectId;
    const version = aepFiles && aepFiles.manifest ? aepFiles.manifest.version : '';

    const manifestCopy = JSON.parse(JSON.stringify(project.manifest));
    applyAepLock(manifestCopy, extensionId, version, aepHash, capabilityIds);
    const verification = verifyAepLock(aepPath, manifestCopy);
    if (!verification.matched) {
        throw new Error('AWP-LOCK-BACKFILL-001: lock backfill failed verification: ' +
            verification.diagnostics.map(d => d.message).join('; '));
    }
    const lock = getAepLocks(manifestCopy).find(entry => entry.id === extensionId) || null;
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

    if (updateAwp) {
        const projectCopy = {
            manifest: manifestCopy,
            ir: project.ir,
            files: project.files
        };
        writeAwp(awpOutPath, projectCopy);


    }

    return {manifest: manifestCopy, lock, aepPath, awpPath: awpOutPath};
}

function collectCapabilityIds(editorCatalog) {
    if (!editorCatalog) return [];
    try {
        const parsed = JSON.parse(editorCatalog.toString('utf8'));
        if (!parsed || !Array.isArray(parsed.capabilities)) return [];
        const ids = [];
        for (const capability of parsed.capabilities) {
            if (capability && typeof capability.id === 'string' && capability.id.trim()) {
                ids.push(capability.id.trim());
            }
        }
        return ids;
    } catch (error) {
        return [];
    }
}

function inspectAepEntries(aepPath) {
    const {inspectArchive} = require('../awp/archive');
    const files = inspectArchive(fs.readFileSync(aepPath));
    const manifestBytes = files.get(AEP_PATH);
    if (!manifestBytes) return {manifest: null, files: []};
    try {
        return {manifest: JSON.parse(manifestBytes.toString('utf8')), files: [...files.keys()]};
    } catch (error) {
        throw new Error(`AWP-LOCK-BACKFILL-002: cannot parse AEP manifest: ${error.message}`);
    }
}
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

function writeAep(aepPath, aepFiles) {
    const path = require('node:path');
    if (!Buffer.isBuffer && !path) throw new Error('AWP-COMPILE-008: node modules unavailable.');
    const zlib = require('node:zlib');
    const names = [...aepFiles.keys()].sort();
    for (const name of names) {
        if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) {
            throw new Error(`AWP-COMPILE-009: unsafe AEP entry path: ${name}`);
        }
    }
    const local = [];
    const central = [];
    let offset = 0;
    for (const name of names) {
        const data = Buffer.from(aepFiles.get(name));
        const entry = buildLocalHeader(name, data, offset);


        local.push(entry.header, entry.data);
        central.push(buildCentralHeader(entry));
        offset += entry.header.length + entry.data.length;
    }
    const directory = Buffer.concat(central);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(names.length, 8);
    eocd.writeUInt16LE(names.length, 10);
    eocd.writeUInt32LE(directory.length, 12);
    eocd.writeUInt32LE(offset, 16);
    fs.mkdirSync(path.dirname(aepPath), {recursive: true});
    fs.writeFileSync(aepPath, Buffer.concat([...local, directory, eocd]));
    return names;
}

function dosTime() {
    return {date: 0x0021, time: 0};
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
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

function buildLocalHeader(name, data, offset) {
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

function buildCentralHeader(entry) {


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

module.exports = {generateAep, generateAepAndLock, readEditorMetadata, AEP_PATH, JAR_PATH, EDITOR_MANIFEST_PATH};

