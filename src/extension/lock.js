'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Computes the lowercase hex SHA-256 of the given buffer or file contents.
 *
 * @param {Buffer|string} input buffer to hash or a filesystem path
 * @returns {string} 64-character lowercase hex digest
 */
function sha256Hex(input) {
    const buffer = Buffer.isBuffer(input) ? input : fs.readFileSync(input);
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

const SHA256_PATTERN = /^[a-fA-F0-9]{64}$/;
const LOCK_ID_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;

/**
 * Returns the array of AEP capability locks recorded in an AWP project
 * manifest, or an empty array when no locks are declared. Locks with
 * malformed ids or non-64-character hashes are silently skipped.
 *
 * @param {object} manifest parsed AWP manifest
 * @returns {Array<{id: string, version: string, sha256: string, capabilities: string[]}>}
 */
function getAepLocks(manifest) {
    const locks = manifest && manifest.extensions && manifest.extensions.aepCapabilities;
    if (!Array.isArray(locks)) return [];
    const result = [];
    for (const lock of locks) {
        if (!lock || typeof lock.id !== 'string' || !LOCK_ID_PATTERN.test(lock.id)) continue;
        if (typeof lock.sha256 !== 'string' || !SHA256_PATTERN.test(lock.sha256)) continue;
        result.push({
            id: lock.id,
            version: typeof lock.version === 'string' ? lock.version : '',
            sha256: lock.sha256.toLowerCase(),
            capabilities: Array.isArray(lock.capabilities) ? lock.capabilities.slice() : []
        });
    }
    return result;
}
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

/**
 * Verifies that the SHA-256 of a generated AEP file matches a lock entry
 * in the .awp project's `extensions.aepCapabilities` array. The id
 * comparison is done against the `aprism.extension.json.extensionId` field
 * inside the AEP. The function never throws; it returns a result object


 * so callers can surface diagnostics without exception-handling.
 *
 * @param {string} aepPath path to the generated .aep
 * @param {object} manifest parsed AWP manifest
 * @returns {{checked: boolean, matched: boolean, lock: object|null, expected: string|null, actual: string|null, diagnostics: Array<object>}}
 */
function verifyAepLock(aepPath, manifest) {
    const diagnostics = [];
    if (!aepPath) {
        diagnostics.push({code: 'AEP-LOCK-001', severity: 'error', message: 'AEP path is required.'});
        return {checked: false, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    const locks = getAepLocks(manifest);
    if (locks.length === 0) {
        return {checked: false, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    let actualHash;
    try {
        actualHash = sha256Hex(aepPath);
    } catch (error) {
        diagnostics.push({code: 'AEP-LOCK-002', severity: 'error', message: `failed to hash AEP: ${error.message}`});
        return {checked: true, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    let aepManifest = null;
    try {
        const {inspectArchive} = require('../awp/archive');
        const files = inspectArchive(fs.readFileSync(aepPath));
        const manifestBytes = files.get('aprism.extension.json');
        if (manifestBytes) aepManifest = JSON.parse(manifestBytes.toString('utf8'));
    } catch (error) {
        diagnostics.push({code: 'AEP-LOCK-003', severity: 'error', message: `failed to read AEP manifest: ${error.message}`});
    }
    const aepId = aepManifest && typeof aepManifest.extensionId === 'string' ? aepManifest.extensionId : '';
    for (const lock of locks) {
        if (lock.id !== aepId) {
            diagnostics.push({
                code: 'AEP-LOCK-004', severity: 'warning',
                message: `lock id "${lock.id}" does not match AEP extensionId "${aepId}".`
            });
            continue;
        }
        if (lock.sha256 === actualHash) {
            return {checked: true, matched: true, lock, expected: lock.sha256, actual: actualHash, diagnostics};
        }
        diagnostics.push({
            code: 'AEP-LOCK-005', severity: 'error',
            message: `AEP hash mismatch for ${lock.id}: expected ${lock.sha256}, got ${actualHash}.`
        });

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

        return {checked: true, matched: false, lock, expected: lock.sha256, actual: actualHash, diagnostics};
    }


    return {checked: true, matched: false, lock: null, expected: null, actual: actualHash, diagnostics};
}

/**
 * Reads the manifest from an .awp project archive and verifies the AEP
 * file against its `extensions.aepCapabilities` lock table. Returns the
 * same shape as {@link verifyAepLock}.
 *
 * @param {string} aepPath path to the generated .aep
 * @param {string} awpPath path to the source .awp project archive
 * @returns {{checked: boolean, matched: boolean, lock: object|null, expected: string|null, actual: string|null, diagnostics: Array<object>}}
 */
function verifyAepLockForAwp(aepPath, awpPath) {
    const diagnostics = [];
    if (!awpPath) {
        diagnostics.push({code: 'AEP-LOCK-010', severity: 'error', message: 'AWP path is required.'});
        return {checked: false, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    let manifest;
    try {
        const {readAwp} = require('../awp/archive');
        const project = readAwp(awpPath);
        manifest = project.manifest;
    } catch (error) {
        diagnostics.push({code: 'AEP-LOCK-011', severity: 'error', message: `failed to read AWP: ${error.message}`});
        return {checked: false, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    return verifyAepLock(aepPath, manifest);
}

/**
 * Recomputes and rewrites the AWP project so its
 * `extensions.aepCapabilities` entries carry the SHA-256 of the generated
 * AEP file. Returns the new lock list. Existing locks whose id is
 * different from the AEP extensionId are preserved. An entry with the
 * matching id is updated in place; if no such entry exists, a new one is
 * inserted.
 *
 * @param {object} manifest parsed AWP manifest (mutated in place)
 * @param {string} aepId the extensionId inside the AEP manifest
 * @param {string} version extension version recorded by the AEP manifest
 * @param {string} aepHash lowercase hex SHA-256 of the AEP file
 * @param {string[]} [capabilities] optional capability ids to associate
 * @returns {Array<object>} the updated `aepCapabilities` array
 */
function applyAepLock(manifest, aepId, version, aepHash, capabilities) {

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

    if (!LOCK_ID_PATTERN.test(aepId)) {
        throw new Error('AEP-LOCK-007: aepId must be a lowercase Aprism identifier.');
    }
    if (!SHA256_PATTERN.test(aepHash)) {


        throw new Error('AEP-LOCK-006: aepHash must be a 64-character hex SHA-256.');
    }
    if (!manifest.extensions || typeof manifest.extensions !== 'object') {
        manifest.extensions = {aepCapabilities: [], ajeCapabilities: [], aweEditors: []};
    }
    const normalisedHash = aepHash.toLowerCase();
    const list = Array.isArray(manifest.extensions.aepCapabilities)
        ? manifest.extensions.aepCapabilities.slice()
        : [];
    const index = list.findIndex(entry => entry && entry.id === aepId);
    const next = {
        id: aepId,
        version: version || '',
        sha256: normalisedHash,
        capabilities: Array.isArray(capabilities) ? capabilities.slice() : (index >= 0 ? (list[index].capabilities || []).slice() : [])
    };
    if (index >= 0) list[index] = next;
    else list.push(next);
    manifest.extensions.aepCapabilities = list;
    return list;
}

/**
 * Returns the array of AJE capability locks recorded in an AWP project
 * manifest, or an empty array when no locks are declared. Locks with
 * malformed ids or non-64-character hashes are silently skipped.
 *
 * @param {object} manifest parsed AWP manifest
 * @returns {Array<{id: string, version: string, sha256: string, capabilities: string[]}>}
 */
function getAjeLocks(manifest) {
    const locks = manifest && manifest.extensions && manifest.extensions.ajeCapabilities;
    if (!Array.isArray(locks)) return [];
    const result = [];
    for (const lock of locks) {
        if (!lock || typeof lock.id !== 'string' || !LOCK_ID_PATTERN.test(lock.id)) continue;
        if (typeof lock.sha256 !== 'string' || !SHA256_PATTERN.test(lock.sha256)) continue;
        result.push({
            id: lock.id,
            version: typeof lock.version === 'string' ? lock.version : '',
            sha256: lock.sha256.toLowerCase(),
            capabilities: Array.isArray(lock.capabilities) ? lock.capabilities.slice() : []
        });
    }

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

    return result;
}

/**
 * Verifies that the SHA-256 of a generated AJE file matches a lock entry
 * in the .awp project's `extensions.ajeCapabilities` array. The id


 * comparison is done against the `aprism.manifest.json.id` field inside
 * the AJE. The function never throws; it returns a result object so
 * callers can surface diagnostics without exception-handling.
 *
 * @param {string} ajePath path to the generated .aje
 * @param {object} manifest parsed AWP manifest
 * @returns {{checked: boolean, matched: boolean, lock: object|null, expected: string|null, actual: string|null, diagnostics: Array<object>}}
 */
function verifyAjeLock(ajePath, manifest) {
    const diagnostics = [];
    if (!ajePath) {
        diagnostics.push({code: 'AJE-LOCK-001', severity: 'error', message: 'AJE path is required.'});
        return {checked: false, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    const locks = getAjeLocks(manifest);
    if (locks.length === 0) {
        return {checked: false, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    let actualHash;
    try {
        actualHash = sha256Hex(ajePath);
    } catch (error) {
        diagnostics.push({code: 'AJE-LOCK-002', severity: 'error', message: `failed to hash AJE: ${error.message}`});
        return {checked: true, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    let ajeManifest = null;
    try {
        const {inspectArchive} = require('../awp/archive');
        const files = inspectArchive(fs.readFileSync(ajePath));
        const manifestBytes = files.get('aprism.manifest.json');
        if (manifestBytes) ajeManifest = JSON.parse(manifestBytes.toString('utf8'));
    } catch (error) {
        diagnostics.push({code: 'AJE-LOCK-003', severity: 'error', message: `failed to read AJE manifest: ${error.message}`});
    }
    const ajeId = ajeManifest && typeof ajeManifest.id === 'string' ? ajeManifest.id : '';
    for (const lock of locks) {
        if (lock.id !== ajeId) {
            diagnostics.push({
                code: 'AJE-LOCK-004', severity: 'warning',
                message: `lock id "${lock.id}" does not match AJE mod id "${ajeId}".`
            });
            continue;

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

        }
        if (lock.sha256 === actualHash) {
            return {checked: true, matched: true, lock, expected: lock.sha256, actual: actualHash, diagnostics};
        }
        diagnostics.push({
            code: 'AJE-LOCK-005', severity: 'error',
            message: `AJE hash mismatch for ${lock.id}: expected ${lock.sha256}, got ${actualHash}.`
        });


        return {checked: true, matched: false, lock, expected: lock.sha256, actual: actualHash, diagnostics};
    }
    return {checked: true, matched: false, lock: null, expected: null, actual: actualHash, diagnostics};
}

/**
 * Reads the manifest from an .awp project archive and verifies the AJE
 * file against its `extensions.ajeCapabilities` lock table. Returns the
 * same shape as {@link verifyAjeLock}.
 *
 * @param {string} ajePath path to the generated .aje
 * @param {string} awpPath path to the source .awp project archive
 * @returns {{checked: boolean, matched: boolean, lock: object|null, expected: string|null, actual: string|null, diagnostics: Array<object>}}
 */
function verifyAjeLockForAwp(ajePath, awpPath) {
    const diagnostics = [];
    if (!awpPath) {
        diagnostics.push({code: 'AJE-LOCK-010', severity: 'error', message: 'AWP path is required.'});
        return {checked: false, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    let manifest;
    try {
        const {readAwp} = require('../awp/archive');
        const project = readAwp(awpPath);
        manifest = project.manifest;
    } catch (error) {
        diagnostics.push({code: 'AJE-LOCK-011', severity: 'error', message: `failed to read AWP: ${error.message}`});
        return {checked: false, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    return verifyAjeLock(ajePath, manifest);
}
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

/**
 * Recomputes and rewrites the AWP project so its
 * `extensions.ajeCapabilities` entries carry the SHA-256 of the generated
 * AJE file. Returns the new lock list. Existing locks whose id is
 * different from the AJE mod id are preserved. An entry with the
 * matching id is updated in place; if no such entry exists, a new one
 * is inserted.
 *
 * @param {object} manifest parsed AWP manifest (mutated in place)
 * @param {string} ajeId the mod id inside the AJE manifest
 * @param {string} version mod version recorded by the AJE manifest
 * @param {string} ajeHash lowercase hex SHA-256 of the AJE file
 * @param {string[]} [capabilities] optional capability ids to associate
 * @returns {Array<object>} the updated `ajeCapabilities` array
 */
function applyAjeLock(manifest, ajeId, version, ajeHash, capabilities) {
    if (!LOCK_ID_PATTERN.test(ajeId)) {
        throw new Error('AJE-LOCK-007: ajeId must be a lowercase Aprism identifier.');


    }
    if (!SHA256_PATTERN.test(ajeHash)) {
        throw new Error('AJE-LOCK-006: ajeHash must be a 64-character hex SHA-256.');
    }
    if (!manifest.extensions || typeof manifest.extensions !== 'object') {
        manifest.extensions = {aepCapabilities: [], ajeCapabilities: [], aweEditors: []};
    }
    const normalisedHash = ajeHash.toLowerCase();
    const list = Array.isArray(manifest.extensions.ajeCapabilities)
        ? manifest.extensions.ajeCapabilities.slice()
        : [];
    const index = list.findIndex(entry => entry && entry.id === ajeId);
    const next = {
        id: ajeId,
        version: version || '',
        sha256: normalisedHash,
        capabilities: Array.isArray(capabilities) ? capabilities.slice() : (index >= 0 ? (list[index].capabilities || []).slice() : [])
    };
    if (index >= 0) list[index] = next;
    else list.push(next);
    manifest.extensions.ajeCapabilities = list;
    return list;
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

/**
 * Returns the array of AWE editor-extension locks recorded in an AWP
 * project manifest, or an empty array when no locks are declared. Locks
 * with malformed ids or non-64-character hashes are silently skipped.
 * The declared AWE permissions are carried in the shared
 * `capabilities` field of the lockedExtension schema.
 *
 * @param {object} manifest parsed AWP manifest
 * @returns {Array<{id: string, version: string, sha256: string, capabilities: string[]}>}
 */
function getAweLocks(manifest) {
    const locks = manifest && manifest.extensions && manifest.extensions.aweEditors;
    if (!Array.isArray(locks)) return [];
    const result = [];
    for (const lock of locks) {
        if (!lock || typeof lock.id !== 'string' || !LOCK_ID_PATTERN.test(lock.id)) continue;
        if (typeof lock.sha256 !== 'string' || !SHA256_PATTERN.test(lock.sha256)) continue;
        result.push({
            id: lock.id,
            version: typeof lock.version === 'string' ? lock.version : '',
            sha256: lock.sha256.toLowerCase(),
            capabilities: Array.isArray(lock.capabilities) ? lock.capabilities.slice() : []
        });
    }
    return result;
}

/**
 * Verifies that the SHA-256 of an .awe editor extension matches a lock
 * entry in the .awp project's `extensions.aweEditors` array. The id
 * comparison is done against the `aprismwarp.extension.json.id` field
 * inside the AWE. The function never throws; it returns a result object
 * so callers can surface diagnostics without exception-handling.
 *
 * @param {string} awePath path to the .awe file
 * @param {object} manifest parsed AWP manifest
 * @returns {{checked: boolean, matched: boolean, lock: object|null, expected: string|null, actual: string|null, diagnostics: Array<object>}}
 */
function verifyAweLock(awePath, manifest) {
    const diagnostics = [];
    if (!awePath) {
        diagnostics.push({code: 'AWE-LOCK-001', severity: 'error', message: 'AWE path is required.'});
        return {checked: false, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    const locks = getAweLocks(manifest);
    if (locks.length === 0) {
        return {checked: false, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    let actualHash;
    try {
        actualHash = sha256Hex(awePath);
    } catch (error) {
        diagnostics.push({code: 'AWE-LOCK-002', severity: 'error', message: `failed to hash AWE: ${error.message}`});
        return {checked: true, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    let aweManifest = null;
    try {
        const {inspectAwe} = require('../awe/inspect');
        const inspection = inspectAwe(awePath);
        aweManifest = inspection.manifest;
    } catch (error) {
        diagnostics.push({code: 'AWE-LOCK-003', severity: 'error', message: `failed to read AWE manifest: ${error.message}`});
    }
    const aweId = aweManifest && typeof aweManifest.id === 'string' ? aweManifest.id : '';
    for (const lock of locks) {
        if (lock.id !== aweId) {
            diagnostics.push({
                code: 'AWE-LOCK-004', severity: 'warning',
                message: `lock id "${lock.id}" does not match AWE extension id "${aweId}".`
            });
            continue;
        }
        if (lock.sha256 === actualHash) {
            return {checked: true, matched: true, lock, expected: lock.sha256, actual: actualHash, diagnostics};
        }
        diagnostics.push({
            code: 'AWE-LOCK-005', severity: 'error',
            message: `AWE hash mismatch for ${lock.id}: expected ${lock.sha256}, got ${actualHash}.`
        });
        return {checked: true, matched: false, lock, expected: lock.sha256, actual: actualHash, diagnostics};
    }
    return {checked: true, matched: false, lock: null, expected: null, actual: actualHash, diagnostics};
}

/**
 * Reads the manifest from an .awp project archive and verifies the .awe
 * file against its `extensions.aweEditors` lock table. Returns the same
 * shape as {@link verifyAweLock}.
 *
 * @param {string} awePath path to the .awe file
 * @param {string} awpPath path to the source .awp project archive
 * @returns {{checked: boolean, matched: boolean, lock: object|null, expected: string|null, actual: string|null, diagnostics: Array<object>}}
 */
function verifyAweLockForAwp(awePath, awpPath) {
    const diagnostics = [];
    if (!awePath) {
        diagnostics.push({code: 'AWE-LOCK-001', severity: 'error', message: 'AWE path is required.'});
        return {checked: false, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    if (!awpPath) {
        diagnostics.push({code: 'AWE-LOCK-011', severity: 'error', message: 'AWP path is required.'});
        return {checked: false, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    let manifest;
    try {
        const {readAwp} = require('../awp/archive');
        manifest = readAwp(awpPath).manifest;
    } catch (error) {
        diagnostics.push({code: 'AWE-LOCK-011', severity: 'error', message: `failed to read AWP: ${error.message}`});
        return {checked: false, matched: false, lock: null, expected: null, actual: null, diagnostics};
    }
    const result = verifyAweLock(awePath, manifest);
    return {checked: result.checked, matched: result.matched, lock: result.lock,
        expected: result.expected, actual: result.actual,
        diagnostics: [...diagnostics, ...result.diagnostics]};
}

/**
 * Applies or replaces the lock entry for one .awe editor extension in an
 * AWP project manifest. The manifest's `extensions.aweEditors` array is
 * created when absent; an existing entry with the same id is replaced
 * in place.
 *
 * @param {object} manifest parsed AWP manifest (mutated in place)
 * @param {string} aweId the extension id inside the AWE manifest
 * @param {string} version extension version recorded by the AWE manifest
 * @param {string} aweHash lowercase hex SHA-256 of the .awe file
 * @param {string[]} [permissions] optional permission ids to associate
 * @returns {Array<object>} the updated `aweEditors` array
 */
function applyAweLock(manifest, aweId, version, aweHash, permissions) {
    if (!LOCK_ID_PATTERN.test(aweId)) {
        throw new Error('AWE-LOCK-007: aweId must be a lowercase Aprism identifier.');
    }
    if (!SHA256_PATTERN.test(aweHash)) {
        throw new Error('AWE-LOCK-006: aweHash must be a 64-character hex SHA-256.');
    }
    if (!manifest.extensions || typeof manifest.extensions !== 'object') {
        manifest.extensions = {aepCapabilities: [], ajeCapabilities: [], aweEditors: []};
    }
    if (!Array.isArray(manifest.extensions.aweEditors)) {
        manifest.extensions.aweEditors = [];
    }
    const normalisedHash = aweHash.toLowerCase();
    const list = manifest.extensions.aweEditors.slice();
    const index = list.findIndex(entry => entry && entry.id === aweId);
    const next = {
        id: aweId,
        version: version || '',
        sha256: normalisedHash,
        capabilities: Array.isArray(permissions) ? permissions.slice() : (index >= 0 ? (list[index].capabilities || []).slice() : [])
    };
    if (index >= 0) list[index] = next;
    else list.push(next);
    manifest.extensions.aweEditors = list;
    return list;
}

module.exports = {sha256Hex, getAepLocks, verifyAepLock, verifyAepLockForAwp, applyAepLock, getAjeLocks, verifyAjeLock, verifyAjeLockForAwp, applyAjeLock, getAweLocks, verifyAweLock, verifyAweLockForAwp, applyAweLock};

