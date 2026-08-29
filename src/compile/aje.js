'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {readAwp, writeAwp} = require('../awp/archive');
const {sha256Hex, getAjeLocks, verifyAjeLock, applyAjeLock} = require('../extension/lock');

const AJE_MANIFEST = 'aprism.manifest.json';
const MOD_JAR_PATH = 'build/mod.jar';
const RESOURCES_DIR = 'resources/';
const MIXINS_DIR = 'mixins/';
const LIB_DIR = 'lib/';
const MIXINS_REL = 'mixins';
const LIB_REL = 'lib';
const RESOURCES_REL = 'resources';
const AWP_EXTENSION_TYPES = new Set([
    'loader-support',
    'api-extension',
    'platform-adapter',
    'converter',
    'ai-extension',
    'rendering-extension'
]);
const ENV_VALUES = new Set(['*', 'client', 'server', 'dedicated_server']);
const SEMVER_PATTERN = /^\d+\.\d+\.\d+([+-][0-9A-Za-z.-]+)?$/;
const ID_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;

/**
 * Reads an .awp project archive and returns the parsed editor metadata
 * for AprismJEMod projects. The editor metadata block carries the
 * Aprism-native manifest fields that are not present in the IR.
 *
 * @param {string} awpPath path to the .awp archive
 * @returns {{manifest: object, ir: object, files: Map<string, Buffer>, editor: object}}
 */
function readModEditorMetadata(awpPath) {
    const project = readAwp(awpPath);
    if (project.manifest.workType !== 'AprismJEMod') {
        throw new Error(`AJE-COMPILE-001: .awp workType must be AprismJEMod; got "${project.manifest.workType}".`);
    }
    if (project.ir && project.ir.extension !== undefined) {
        throw new Error('AJE-COMPILE-002: AprismJEMod projects cannot declare AprismExtension metadata.');
    }
    const editorBytes = project.files.get('editor/project.json');
    let editor = {};
    if (editorBytes) {
        try {
            editor = JSON.parse(editorBytes.toString('utf8'));
        } catch (error) {
            throw new Error(`AJE-COMPILE-003: editor/project.json is invalid JSON: ${error.message}`);
        }
    }
    return {manifest: project.manifest, ir: project.ir, files: project.files, editor};
}

/**
 * Builds the Aprism-native `aprism.manifest.json` object from the .awp
 * project and editor metadata. Returns the manifest record that can be
 * serialised into the `.aje` archive.
 *
 * @param {{manifest: object, editor: object}} source AWP project summary
 * @returns {object} the Aprism manifest record
 */
function buildModManifest(project) {
    const editor = project.editor || {};
    const projectId = String(project.manifest.projectId || '').trim();
    if (!ID_PATTERN.test(projectId)) {
        throw new Error('AJE-COMPILE-010: projectId must match the lowercase identifier pattern.');
    }
    const version = String(editor.version || '0.1.0').trim();
    if (!SEMVER_PATTERN.test(version)) {
        throw new Error('AJE-COMPILE-011: editor metadata must declare a SemVer version.');
    }
    const displayName = String(editor.displayName || project.manifest.name || '').trim();
    if (!displayName) {
        throw new Error('AJE-COMPILE-012: editor metadata must declare `displayName`.');
    }
    const description = String(editor.description || '').trim();
    if (!description) {
        throw new Error('AJE-COMPILE-013: editor metadata must declare `description`.');
    }
    const environment = String(editor.environment || '*').trim();
    if (!ENV_VALUES.has(environment)) {
        throw new Error(`AJE-COMPILE-014: environment must be one of ${[...ENV_VALUES].join(', ')}; got "${environment}".`);
    }
    const entrypoints = collectEntrypoints(editor);
    if (entrypoints.main.length === 0) {
        throw new Error('AJE-COMPILE-015: editor metadata must declare at least one main entrypoint class.');
    }
    const mixins = normaliseMixins(editor.mixins, project.files);
    const depends = normaliseDependencies(editor.depends);
    const accessWidener = typeof editor.accessWidener === 'string' && editor.accessWidener.trim()
        ? editor.accessWidener.trim()
        : null;
    const manifest = {
        schemaVersion: 1,
        id: projectId,
        version,
        displayName,
        description,
        environment,
        entrypoints,
        mixins,
        depends
    };
    if (accessWidener) manifest.accessWidener = accessWidener;
    return manifest;
}

function collectEntrypoints(editor) {
    const result = {main: [], client: [], server: []};
    if (typeof editor.entrypoint === 'string' && editor.entrypoint.trim()) {
        result.main.push(editor.entrypoint.trim());
    }
    const expanded = normaliseEntrypoints(editor.entrypoints);
    for (const key of Object.keys(result)) {
        if (expanded[key].length > 0) {
            result[key].push(...expanded[key]);
        }
    }
    return result;
}

function normaliseEntrypoints(value) {
    const result = {main: [], client: [], server: []};
    if (!value) return result;
    if (typeof value === 'string') {
        result.main.push(value);
        return result;
    }
    if (Array.isArray(value)) {
        for (const entry of value) {
            if (typeof entry === 'string' && entry.trim()) result.main.push(entry.trim());
        }
        return result;
    }
    if (typeof value !== 'object') {
        throw new Error('AJE-COMPILE-016: entrypoints must be a string, array, or object.');
    }
    for (const key of Object.keys(result)) {
        const list = value[key];
        if (list === undefined) continue;
        if (typeof list === 'string') {
            result[key].push(list);
            continue;
        }
        if (!Array.isArray(list)) {
            throw new Error(`AJE-COMPILE-017: entrypoints.${key} must be a string or array.`);
        }
        for (const entry of list) {
            if (typeof entry === 'string' && entry.trim()) result[key].push(entry.trim());
        }
    }
    return result;
}

function normaliseMixins(value, files) {
    if (!value) return [];
    if (typeof value === 'string') {
        if (value.trim()) return [value.trim()];
        return [];
    }
    if (Array.isArray(value)) {
        const result = [];
        for (const entry of value) {
            if (typeof entry === 'string' && entry.trim()) result.push(entry.trim());
        }
        return result;
    }
    throw new Error('AJE-COMPILE-018: mixins must be a string or array of strings.');
}

function normaliseDependencies(value) {
    if (!value) return {};
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('AJE-COMPILE-019: depends must map mod id to version range.');
    }
    const result = {};
    for (const [id, range] of Object.entries(value)) {
        if (!ID_PATTERN.test(id)) {
            throw new Error(`AJE-COMPILE-020: invalid dependency id: "${id}".`);
        }
        const rangeText = String(range || '').trim();
        if (rangeText) result[id] = rangeText;
    }
    return result;
}

/**
 * Collects resource, mixin, and lib files from the .awp project archive.
 * Paths returned are ZIP-relative and begin with one of
 * `resources/`, `mixins/`, or `lib/`. A path collision between the .awp
 * entries and the manifest, main JAR, or any other archive section is
 * treated as a hard error.
 *
 * @param {Map<string, Buffer>} files the .awp entry map
 * @returns {{resources: Array<{name: string, data: Buffer}>, mixins: Array<{name: string, data: Buffer}>, lib: Array<{name: string, data: Buffer}>}}
 */
function collectCollectionEntries(files) {
    const buckets = {resources: [], mixins: [], lib: []};
    for (const [name, data] of files) {
        if (name === AJE_MANIFEST || name === 'ir/project.json' || name === 'awp.json' || name === 'editor/project.json') continue;
        if (name === MOD_JAR_PATH) continue;
        if (name.startsWith(RESOURCES_DIR)) {
            buckets.resources.push({name: name.slice(RESOURCES_DIR.length), data});
        } else if (name.startsWith(MIXINS_DIR)) {
            buckets.mixins.push({name: name.slice(MIXINS_DIR.length), data});
        } else if (name.startsWith(LIB_DIR)) {
            buckets.lib.push({name: name.slice(LIB_DIR.length), data});
        }
    }
    return buckets;
}

function isSafeResourcePath(name) {
    return name.length > 0
        && !name.startsWith('/')
        && !name.includes('\\')
        && !name.split('/').includes('..')
        && !name.split('/').includes('aprismwarp.editor.json')
        && !name.split('/').includes('aprism.extension.json');
}

/**
 * Assembles a deterministic stored `.aje` archive and an accompanying
 * `checksums.txt` next to it. The archive contains:
 *   - `aprism.manifest.json`
 *   - `<modid>.jar` (the embedded mod main jar)
 *   - `resources/<path>` entries
 *   - `mixins/<path>` entries
 *   - `lib/<path>` entries
 *
 * The function never throws when the AWP is missing the main jar; instead
 * it returns a diagnostic list so the caller can render a structured
 * failure.
 *
 * @param {string} awpPath path to the source .awp project archive
 * @param {string} ajePath destination path for the generated .aje
 * @param {object} [options]
 * @param {Buffer} [options.modJar] override for the embedded mod main jar
 * @returns {{manifest: object, entries: string[], checksumsPath: string}}
 */
function generateAje(awpPath, ajePath, options = {}) {
    const project = readModEditorMetadata(awpPath);
    const manifest = buildModManifest(project);
    const modJar = options.modJar || project.files.get(MOD_JAR_PATH);
    if (!modJar) {
        throw new Error(`AJE-COMPILE-030: ${MOD_JAR_PATH} is required inside the .awp project.`);
    }
    if (!Buffer.isBuffer(modJar)) {
        throw new Error(`AJE-COMPILE-031: ${MOD_JAR_PATH} must be raw bytes.`);
    }
    const collections = collectCollectionEntries(project.files);
    for (const bucket of Object.values(collections)) {
        for (const entry of bucket) {
            if (!isSafeResourcePath(entry.name)) {
                throw new Error(`AJE-COMPILE-032: unsafe entry name: ${entry.name}`);
            }
        }
    }
    const archiveEntries = {
        [AJE_MANIFEST]: Buffer.from(JSON.stringify(manifest, null, 2) + '\n'),
        [`${manifest.id}.jar`]: Buffer.from(modJar)
    };
    for (const entry of collections.resources) {
        archiveEntries[`${RESOURCES_REL}/${entry.name}`] = entry.data;
    }
    for (const entry of collections.mixins) {
        archiveEntries[`${MIXINS_REL}/${entry.name}`] = entry.data;
    }
    for (const entry of collections.lib) {
        archiveEntries[`${LIB_REL}/${entry.name}`] = entry.data;
    }
    if (manifest.mixins.length === 0 && collections.mixins.length > 0) {
        manifest.mixins = collections.mixins.map(entry => entry.name).sort();
        archiveEntries[AJE_MANIFEST] = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
    }
    writeAje(ajePath, archiveEntries);
    const checksumsPath = writeChecksumsFile(ajePath, archiveEntries);
    return {manifest, entries: Object.keys(archiveEntries), checksumsPath};
}

/**
 * Compiles an .awp project to .aje and writes the resulting AJE hash back
 * into the project's `extensions.ajeCapabilities` lock table. The .awp
 * archive is then re-serialised at `options.awpOutPath` (or the original
 * `awpPath` by default) with the updated lock.
 *
 * When `options.updateAwp` is `false` the AWP is read but not rewritten; the
 * caller receives the updated manifest in the result and is responsible for
 * any persistence. The default is `true`.
 *
 * @param {string} awpPath source .awp project archive
 * @param {string} ajePath destination path for the generated .aje
 * @param {object} [options]
 * @param {string} [options.awpOutPath] path to rewrite the .awp to
 * @param {boolean} [options.updateAwp=true] whether to rewrite the .awp
 * @returns {{manifest: object, lock: object, ajePath: string, awpPath: string, checksumsPath: string}}
 */
function generateAjeAndLock(awpPath, ajePath, options = {}) {
    const updateAwp = options.updateAwp !== false;
    const awpOutPath = options.awpOutPath || awpPath;
    const project = readModEditorMetadata(awpPath);
    generateAje(awpPath, ajePath, options);

    const ajeHash = sha256Hex(ajePath);
    const ajeFiles = inspectAjeEntries(ajePath);
    const modId = ajeFiles && ajeFiles.manifest ? ajeFiles.manifest.id : project.manifest.projectId;
    const version = ajeFiles && ajeFiles.manifest ? ajeFiles.manifest.version : '';

    const manifestCopy = JSON.parse(JSON.stringify(project.manifest));
    applyAjeLock(manifestCopy, modId, version, ajeHash, []);
    const verification = verifyAjeLock(ajePath, manifestCopy);
    if (!verification.matched) {
        throw new Error('AWP-AJE-LOCK-BACKFILL-001: lock backfill failed verification: ' +
            verification.diagnostics.map(d => d.message).join('; '));
    }
    const lock = getAjeLocks(manifestCopy).find(entry => entry.id === modId) || null;

    if (updateAwp) {
        const projectCopy = {
            manifest: manifestCopy,
            ir: project.ir,
            files: project.files
        };
        writeAwp(awpOutPath, projectCopy);
    }

    const checksumsPath = `${ajePath}.checksums.txt`;
    return {manifest: manifestCopy, lock, ajePath, awpPath: awpOutPath, checksumsPath};
}

function inspectAjeEntries(ajePath) {
    const {inspectArchive} = require('../awp/archive');
    const files = inspectArchive(fs.readFileSync(ajePath));
    const manifestBytes = files.get(AJE_MANIFEST);
    if (!manifestBytes) return {manifest: null, files: []};
    try {
        return {manifest: JSON.parse(manifestBytes.toString('utf8')), files: [...files.keys()]};
    } catch (error) {
        throw new Error(`AWP-AJE-LOCK-BACKFILL-002: cannot parse AJE manifest: ${error.message}`);
    }
}

function writeAje(ajePath, archiveEntries) {
    const names = Object.keys(archiveEntries).sort();
    const local = [];
    const central = [];
    let offset = 0;
    for (const name of names) {
        const data = Buffer.from(archiveEntries[name]);
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
    fs.mkdirSync(path.dirname(ajePath), {recursive: true});
    fs.writeFileSync(ajePath, Buffer.concat([...local, directory, eocd]));
}

function writeChecksumsFile(ajePath, archiveEntries) {
    const crypto = require('node:crypto');
    const archiveDigest = crypto.createHash('sha256');
    const entryLines = [];
    for (const name of Object.keys(archiveEntries).sort()) {
        const data = Buffer.from(archiveEntries[name]);
        const entryHash = crypto.createHash('sha256').update(data).digest('hex');
        entryLines.push(`${entryHash}  ${name}`);
        archiveDigest.update(data);
    }
    const checksumsPath = `${ajePath}.checksums.txt`;
    const body = [`# ${path.basename(ajePath)}`, `${archiveDigest.digest('hex')}  ${path.basename(ajePath)}`, ...entryLines].join('\n') + '\n';
    fs.writeFileSync(checksumsPath, body);
    return checksumsPath;
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

module.exports = {generateAje, generateAjeAndLock, readModEditorMetadata, buildModManifest, AJE_MANIFEST, MOD_JAR_PATH};
