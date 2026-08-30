'use strict';

const EXTENSION_TYPES = new Set([
    'loader-support',
    'api-extension',
    'platform-adapter',
    'converter',
    'ai-extension',
    'rendering-extension'
]);
const LOADER_KEYS = new Set(['Fa', 'Fo', 'N', 'L', 'Q']);
const ID_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;
const ENTRYPOINT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)+$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+([+-][0-9A-Za-z.-]+)?$/;
const SEMVER_RANGE_PATTERN = /^[0-9A-Za-z.*+\-^\[\]()<>=~ ]+$/;

/**
 * Validates and normalises an Aprism extension manifest derived from an
 * AprismWarp `AprismExtension` IR project. Throws a single Error whose
 * message begins with `EXT-` when the input cannot be turned into a valid
 * `aprism.extension.json`. The returned object is plain JSON, ready to be
 * serialised and written next to the runtime extension JAR inside the
 * produced `.aep`.
 *
 * @param {{
 *   projectId: string,
 *   ir: { extension: { type: string, aprismRange: string,
 *                      loaderKey?: string, loaderRange?: string,
 *                      provides?: string[], depends?: object, priority?: number } },
 *   target: { edition: string, minecraft: string, aprism: string },
 *   entrypoint: string,
 *   displayName: string,
 *   description: string,
 *   version?: string
 * }} input manifest inputs
 * @returns {object} normalised extension manifest
 */
function buildExtensionManifest(input) {
    if (!input || typeof input !== 'object') {
        throw new Error('EXT-001: extension manifest input is required.');
    }
    const extension = input.ir && input.ir.extension;
    if (!extension || typeof extension !== 'object') {
        throw new Error('EXT-002: IR must declare an `extension` block for AprismExtension projects.');
    }
    const projectId = String(input.projectId || '').trim();
    if (!ID_PATTERN.test(projectId)) {
        throw new Error(`EXT-003: projectId must match ${ID_PATTERN}.`);
    }
    if (input.target && (input.target.edition !== 'JE' && input.target.edition !== 'BE')) {

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

        throw new Error('EXT-004: target edition must be JE or BE.');
    }
    const type = String(extension.type || '').trim();
    if (!EXTENSION_TYPES.has(type)) {
        throw new Error(`EXT-005: unknown extension type: ${type}`);
    }
    const aprismRange = String(extension.aprismRange || '').trim();
    if (!aprismRange) {
        throw new Error('EXT-006: aprismRange is required.');
    }
    const entrypoint = String(input.entrypoint || '').trim();
    if (!ENTRYPOINT_PATTERN.test(entrypoint)) {
        throw new Error(`EXT-007: entrypoint must be a fully-qualified Java class name.`);
    }
    const displayName = String(input.displayName || '').trim();
    if (!displayName) {
        throw new Error('EXT-008: displayName is required.');
    }
    const description = String(input.description || '').trim();
    if (!description) {
        throw new Error('EXT-009: description is required.');
    }
    const version = String(input.version || '0.1.0').trim();
    if (!SEMVER_PATTERN.test(version)) {
        throw new Error(`EXT-010: version must be SemVer (MAJOR.MINOR.PATCH).`);
    }
    const loaderKey = extension.loaderKey ? String(extension.loaderKey).trim() : '';
    const loaderRange = extension.loaderRange ? String(extension.loaderRange).trim() : '';
    if (type === 'loader-support') {
        if (!LOADER_KEYS.has(loaderKey)) {
            throw new Error(`EXT-011: loader-support type requires loaderKey in {${[...LOADER_KEYS].join(', ')}}; got "${loaderKey}".`);
        }
        if (!loaderRange || !SEMVER_RANGE_PATTERN.test(loaderRange)) {
            throw new Error('EXT-012: loader-support type requires a SemVer range loaderRange.');
        }
    } else {
        if (loaderKey) {
            throw new Error('EXT-013: only loader-support type may declare loaderKey.');
        }
        if (loaderRange) {
            throw new Error('EXT-014: only loader-support type may declare loaderRange.');
        }
    }
    const provides = sanitizeStringList(extension.provides, 'provides');
    const depends = sanitizeDependMap(extension.depends, 'depends');
    const priority = Number.isInteger(extension.priority) ? extension.priority : 0;
    const mcEdit = (input.target && input.target.edition) || 'JE';
    const mcVersion = (input.target && input.target.minecraft) || '';

    const manifest = {

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

        extensionId: projectId,
        version,
        type,
        aprismRange,
        mcEdit,
        mcVersion,
        entrypoint,
        displayName,
        description,
        provides,
        depends,
        priority
    };
    if (type === 'loader-support') {
        manifest.loaderKey = loaderKey;
        manifest.loaderRange = loaderRange;
    }
    if (provides.length === 0) delete manifest.provides;
    if (Object.keys(depends).length === 0) delete manifest.depends;
    return manifest;
}

function sanitizeStringList(value, field) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
        throw new Error(`EXT-020: ${field} must be an array of strings.`);
    }
    const seen = new Set();
    for (const item of value) {
        if (typeof item !== 'string' || !item.trim()) {
            throw new Error(`EXT-021: ${field} contains an empty or non-string value.`);
        }
        const trimmed = item.trim();
        if (seen.has(trimmed)) {
            throw new Error(`EXT-022: ${field} contains duplicate value: ${trimmed}.`);
        }
        seen.add(trimmed);
    }
    return [...seen];
}

function sanitizeDependMap(value, field) {
    if (value === undefined || value === null) return {};
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`EXT-030: ${field} must map extension id to version range.`);
    }
    const result = {};
    for (const [id, range] of Object.entries(value)) {
        if (!ID_PATTERN.test(id)) {
            throw new Error(`EXT-031: ${field} contains invalid extension id: ${id}.`);

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

        }
        const rangeText = String(range || '').trim();
        if (!rangeText) {
            throw new Error(`EXT-032: ${field}.${id} is missing a range.`);
        }
        if (!SEMVER_RANGE_PATTERN.test(rangeText)) {
            throw new Error(`EXT-033: ${field}.${id} range must be a SemVer range expression.`);
        }
        result[id] = rangeText;
    }
    return result;
}

/**
 * Validates an Aprism extension manifest against the same rules used to
 * build one from IR. Exposed for projects that ship a hand-written
 * `aprism.extension.json`.
 *
 * @param {object} manifest extension manifest to validate
 * @returns {{valid: boolean, diagnostics: Array<{code: string, severity: string, message: string}>}}
 */
function validateExtensionManifest(manifest) {
    const diagnostics = [];
    const error = (code, message) => diagnostics.push({code, severity: 'error', message});
    if (!manifest || typeof manifest !== 'object') {
        error('EXT-V001', 'extension manifest must be an object.');
        return {valid: false, diagnostics};
    }
    if (!ID_PATTERN.test(manifest.extensionId || '')) {
        error('EXT-V002', 'extensionId is invalid.');
    }
    if (!EXTENSION_TYPES.has(manifest.type)) {
        error('EXT-V003', `type must be one of ${[...EXTENSION_TYPES].join(', ')}; got "${manifest.type}".`);
    }
    if (!SEMVER_PATTERN.test(manifest.version || '')) {
        error('EXT-V004', 'version must be SemVer (MAJOR.MINOR.PATCH).');
    }
    if (!manifest.aprismRange || !SEMVER_RANGE_PATTERN.test(manifest.aprismRange)) {
        error('EXT-V005', 'aprismRange is required.');
    }
    if (!ENTRYPOINT_PATTERN.test(manifest.entrypoint || '')) {
        error('EXT-V006', 'entrypoint must be a fully-qualified Java class name.');
    }
    if (!manifest.displayName) {
        error('EXT-V007', 'displayName is required.');
    }
    if (!manifest.description) {
        error('EXT-V008', 'description is required.');
    }
    if (manifest.mcEdit && manifest.mcEdit !== 'JE' && manifest.mcEdit !== 'BE') {

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

        error('EXT-V009', 'mcEdit must be JE or BE.');
    }
    if (manifest.type === 'loader-support') {
        if (!LOADER_KEYS.has(manifest.loaderKey)) {
            error('EXT-V010', `loader-support requires loaderKey in {${[...LOADER_KEYS].join(', ')}}; got "${manifest.loaderKey}".`);
        }
        if (!manifest.loaderRange || !SEMVER_RANGE_PATTERN.test(manifest.loaderRange)) {
            error('EXT-V011', 'loader-support requires a SemVer range loaderRange.');
        }
    } else if (manifest.loaderKey || manifest.loaderRange) {
        error('EXT-V012', 'only loader-support may declare loaderKey/loaderRange.');
    }
    return {valid: diagnostics.length === 0, diagnostics};
}

module.exports = {buildExtensionManifest, validateExtensionManifest, EXTENSION_TYPES, LOADER_KEYS};
