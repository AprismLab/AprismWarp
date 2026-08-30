'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {sha256Hex, getAweLocks, verifyAweLock, verifyAweLockForAwp, applyAweLock} = require('../../src/extension/lock');
const {writeAwp} = require('../../src/awp/archive');
const {buildAwe} = require('../awe/awe-fixture');

const repoRoot = path.resolve(__dirname, '..', '..');

const aweManifest = {
    schema: 'aprismwarp.extension/v1',
    id: 'java-inspector',
    version: '1.0.0',
    name: 'Java Inspector',
    permissions: ['project.read']
};

function writeTempAwe() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awe-lock-'));
    const file = path.join(dir, 'extension.awe');
    fs.writeFileSync(file, buildAwe(aweManifest, [['blocks.json', '{"blocks":[]}']]));
    return file;
}

function awpManifestWithLocks(lockArray) {
    const manifest = {
        format: 'aprismwarp-project',
        schemaVersion: 1,
        projectId: 'lock-test',
        name: 'Lock Test',
        workType: 'AprismJEMod',
        workProfile: {
            minecraftVersion: '26.2',
            aprismVersion: 'v26.8-Alpha.7',
            workType: 'AprismJEMod'
        },
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        source: {editor: 'aprismwarp-native', project: 'editor/project.json', ir: 'ir/project.json'}
    };
    if (lockArray) manifest.extensions = {aweEditors: lockArray};
    return manifest;
}

function minimalIr() {
    return {
        irVersion: 1,
        projectId: 'lock-test',
        workType: 'AprismJEMod',
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        capabilities: ['basic'],
        declarations: [],
        handlers: []
    };
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('getAweLocks returns an empty array when no locks are declared', () => {
    assert.deepEqual(getAweLocks({}), []);
    assert.deepEqual(getAweLocks({extensions: {}}), []);
    assert.deepEqual(getAweLocks(awpManifestWithLocks(undefined)), []);
});

test('getAweLocks normalises hashes and skips malformed entries', () => {
    const locks = getAweLocks(awpManifestWithLocks([
        {id: 'good-one', version: '1.0.0', sha256: 'A'.repeat(64), capabilities: ['project.read']},
        {id: 'BAD-ID', version: '1.0.0', sha256: 'b'.repeat(64)},
        {id: 'good-two', version: '1.0.0', sha256: 'nothex'}
    ]));
    assert.equal(locks.length, 1);
    assert.equal(locks[0].id, 'good-one');
    assert.equal(locks[0].sha256, 'a'.repeat(64));
    assert.deepEqual(locks[0].capabilities, ['project.read']);
});

test('verifyAweLock returns no match when no locks are declared', () => {
    const awePath = writeTempAwe();
    const result = verifyAweLock(awePath, {});
    assert.equal(result.checked, false);
    assert.equal(result.matched, false);
    fs.rmSync(path.dirname(awePath), {recursive: true, force: true});
});

test('verifyAweLock matches a freshly locked AWE after applyAweLock', () => {
    const awePath = writeTempAwe();
    const manifest = {};
    const hash = sha256Hex(awePath);
    applyAweLock(manifest, 'java-inspector', '1.0.0', hash, ['project.read']);
    const result = verifyAweLock(awePath, manifest);
    assert.equal(result.checked, true, JSON.stringify(result.diagnostics));
    assert.equal(result.matched, true);
    assert.equal(result.lock.id, 'java-inspector');
    assert.equal(result.actual, hash);
    fs.rmSync(path.dirname(awePath), {recursive: true, force: true});
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('verifyAweLock flags a hash mismatch', () => {
    const awePath = writeTempAwe();
    const manifest = {};
    const fakeHash = sha256Hex(Buffer.from('different-bytes'));
    applyAweLock(manifest, 'java-inspector', '1.0.0', fakeHash);
    const result = verifyAweLock(awePath, manifest);
    assert.equal(result.checked, true);
    assert.equal(result.matched, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AWE-LOCK-005'));
    fs.rmSync(path.dirname(awePath), {recursive: true, force: true});
});

test('verifyAweLock warns when a lock id does not match the AWE id', () => {
    const awePath = writeTempAwe();
    const manifest = {};
    applyAweLock(manifest, 'other-extension', '1.0.0', sha256Hex(awePath));
    const result = verifyAweLock(awePath, manifest);
    assert.equal(result.matched, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AWE-LOCK-004'));
    fs.rmSync(path.dirname(awePath), {recursive: true, force: true});
});

test('applyAweLock updates an existing lock entry rather than duplicating it', () => {
    const manifest = {};
    applyAweLock(manifest, 'java-inspector', '1.0.0', 'a'.repeat(64), ['project.read']);
    applyAweLock(manifest, 'java-inspector', '1.1.0', 'b'.repeat(64));
    const locks = getAweLocks(manifest);
    assert.equal(locks.length, 1);
    assert.equal(locks[0].version, '1.1.0');
    assert.equal(locks[0].sha256, 'b'.repeat(64));
    assert.deepEqual(locks[0].capabilities, ['project.read']);
});

test('applyAweLock rejects malformed ids and hashes', () => {
    const manifest = {};
    assert.throws(() => applyAweLock(manifest, 'Bad Id', '1.0.0', 'a'.repeat(64)), /AWE-LOCK-007/);
    assert.throws(() => applyAweLock(manifest, 'good-id', '1.0.0', 'nothex'), /AWE-LOCK-006/);
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('verifyAweLockForAwp reads the AWP manifest and matches a freshly locked AWE', () => {
    const awePath = writeTempAwe();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awp-lock-'));
    const awpPath = path.join(dir, 'project.awp');
    const manifest = awpManifestWithLocks(undefined);
    applyAweLock(manifest, 'java-inspector', '1.0.0', sha256Hex(awePath), ['project.read']);
    writeAwp(awpPath, {manifest, ir: minimalIr()});
    const result = verifyAweLockForAwp(awePath, awpPath);
    assert.equal(result.checked, true, JSON.stringify(result.diagnostics));
    assert.equal(result.matched, true);
    fs.rmSync(path.dirname(awePath), {recursive: true, force: true});
    fs.rmSync(dir, {recursive: true, force: true});
});

test('verifyAweLockForAwp flags a hash mismatch and exposes the AWE-LOCK-005 diagnostic', () => {
    const awePath = writeTempAwe();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awp-lock-'));
    const awpPath = path.join(dir, 'project.awp');
    const manifest = awpManifestWithLocks(undefined);
    applyAweLock(manifest, 'java-inspector', '1.0.0', 'c'.repeat(64));
    writeAwp(awpPath, {manifest, ir: minimalIr()});
    const result = verifyAweLockForAwp(awePath, awpPath);
    assert.equal(result.matched, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AWE-LOCK-005'));
    fs.rmSync(path.dirname(awePath), {recursive: true, force: true});
    fs.rmSync(dir, {recursive: true, force: true});
});

test('verifyAweLockForAwp reports an AWE-LOCK-011 diagnostic when the AWP cannot be read', () => {
    const awePath = writeTempAwe();
    const result = verifyAweLockForAwp(awePath, path.join(os.tmpdir(), 'missing.awp'));
    assert.equal(result.checked, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AWE-LOCK-011'));
    fs.rmSync(path.dirname(awePath), {recursive: true, force: true});
});

test('verifyAweLockForAwp requires a non-empty AWP path', () => {
    const awePath = writeTempAwe();
    const result = verifyAweLockForAwp(awePath, '');
    assert.equal(result.checked, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AWE-LOCK-011'));
    fs.rmSync(path.dirname(awePath), {recursive: true, force: true});
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover
