'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {sha256Hex, getAepLocks, verifyAepLock, verifyAepLockForAwp, applyAepLock} = require('../../src/extension/lock');
const {generateAep} = require('../../src/compile/aep');
const {inspectArchive, readAwp, writeAwp} = require('../../src/awp/archive');

function makeTempDir(label) {
    return fs.mkdtempSync(path.join(os.tmpdir(), `aprismwarp-${label}-`));
}

function buildExtensionAwp(workspaceDir) {
    const manifest = {
        format: 'aprismwarp-project',
        schemaVersion: 1,
        projectId: 'example-extension',
        name: 'Example Extension',
        workType: 'AprismExtension',
        workProfile: {
            minecraftVersion: '26.2',
            aprismVersion: 'v26.8-Alpha.7',
            workType: 'AprismExtension'
        },
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        source: {editor: 'aprismwarp-native', project: 'editor/project.json', ir: 'ir/project.json'}
    };
    const ir = {
        irVersion: 1,
        projectId: 'example-extension',
        workType: 'AprismExtension',
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        capabilities: ['basic'],
        extension: {type: 'api-extension', aprismRange: '>=26.8.0'},
        declarations: [],
        handlers: []
    };
    const editor = {
        entrypoint: 'com.example.MyExtension',
        displayName: 'Example Extension',
        description: 'A demonstration extension for tests.',
        version: '0.1.0'
    };
    const awpPath = path.join(workspaceDir, 'project.awp');
    writeAwp(awpPath, {manifest, ir, files: new Map([
        ['editor/project.json', Buffer.from(JSON.stringify(editor, null, 2) + '\n')],
        ['build/extension.jar', Buffer.from('placeholder-jar')]
    ])});
    return {awpPath, manifest, ir};
}

test('sha256Hex returns a 64-character lowercase hex digest', () => {
    const hash = sha256Hex(Buffer.from('hello world'));
    assert.equal(hash, 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    assert.equal(hash.length, 64);
});

test('sha256Hex hashes from a path', () => {
    const dir = makeTempDir('lock-hash');
    try {
        const file = path.join(dir, 'data.bin');
        fs.writeFileSync(file, Buffer.from('hello world'));
        assert.equal(sha256Hex(file), 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('getAepLocks returns an empty array when no locks are declared', () => {
    const manifest = {extensions: {aepCapabilities: []}};
    assert.deepEqual(getAepLocks(manifest), []);
    assert.deepEqual(getAepLocks({}), []);
});

test('getAepLocks normalises hashes and skips malformed entries', () => {
    const manifest = {
        extensions: {
            aepCapabilities: [
                {id: 'good', version: '1.0.0', sha256: 'ABCDEF' + '0'.repeat(58)},
                {id: '9bad', sha256: '00'.repeat(32)},
                {id: 'lower-only', sha256: 'not-a-hash'},
                null
            ]
        }
    };
    const locks = getAepLocks(manifest);
    assert.equal(locks.length, 1);
    assert.equal(locks[0].id, 'good');
    assert.equal(locks[0].sha256, 'abcdef' + '0'.repeat(58));
});

test('verifyAepLock returns no match when no locks are declared', () => {
    const dir = makeTempDir('lock-nolocks');
    try {
        const {awpPath} = buildExtensionAwp(dir);
        const aepPath = path.join(dir, 'output.aep');
        generateAep(awpPath, aepPath);
        const result = verifyAepLock(aepPath, {extensions: {}});
        assert.equal(result.checked, false);
        assert.equal(result.matched, false);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('verifyAepLock matches a freshly generated AEP after applyAepLock', () => {
    const dir = makeTempDir('lock-roundtrip');
    try {
        const {awpPath, manifest} = buildExtensionAwp(dir);
        const aepPath = path.join(dir, 'output.aep');
        generateAep(awpPath, aepPath);
        const actual = sha256Hex(aepPath);
        applyAepLock(manifest, 'example-extension', '0.1.0', actual, ['example:capability']);
        const result = verifyAepLock(aepPath, manifest);
        assert.equal(result.checked, true);
        assert.equal(result.matched, true);
        assert.equal(result.expected, actual);
        assert.equal(result.actual, actual);
        assert.equal(result.lock.id, 'example-extension');
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('verifyAepLock flags a hash mismatch', () => {
    const dir = makeTempDir('lock-mismatch');
    try {
        const {awpPath, manifest} = buildExtensionAwp(dir);
        const aepPath = path.join(dir, 'output.aep');
        generateAep(awpPath, aepPath);
        const wrong = 'a'.repeat(64);
        applyAepLock(manifest, 'example-extension', '0.1.0', wrong, []);
        const result = verifyAepLock(aepPath, manifest);
        assert.equal(result.checked, true);
        assert.equal(result.matched, false);
        assert.equal(result.expected, wrong);
        assert.notEqual(result.actual, wrong);
        assert.ok(result.diagnostics.some(d => d.code === 'AEP-LOCK-005'));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('verifyAepLock warns when a lock id does not match the AEP extensionId', () => {
    const dir = makeTempDir('lock-id');
    try {
        const {awpPath, manifest} = buildExtensionAwp(dir);
        const aepPath = path.join(dir, 'output.aep');
        generateAep(awpPath, aepPath);
        const actual = sha256Hex(aepPath);
        applyAepLock(manifest, 'different-extension', '0.1.0', actual, []);
        const result = verifyAepLock(aepPath, manifest);
        assert.equal(result.checked, true);
        assert.equal(result.matched, false);
        assert.ok(result.diagnostics.some(d => d.code === 'AEP-LOCK-004'));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('applyAepLock updates an existing lock entry rather than duplicating it', () => {
    const manifest = {extensions: {aepCapabilities: [
        {id: 'aa', version: '0.0.1', sha256: 'a'.repeat(64)},
        {id: 'bb', version: '0.0.1', sha256: 'b'.repeat(64)}
    ]}};
    const newHash = 'c'.repeat(64);
    applyAepLock(manifest, 'aa', '0.2.0', newHash, ['new:cap']);
    assert.equal(manifest.extensions.aepCapabilities.length, 2);
    assert.equal(manifest.extensions.aepCapabilities[0].id, 'aa');
    assert.equal(manifest.extensions.aepCapabilities[0].sha256, newHash);
    assert.equal(manifest.extensions.aepCapabilities[0].version, '0.2.0');
    assert.deepEqual(manifest.extensions.aepCapabilities[0].capabilities, ['new:cap']);
    assert.equal(manifest.extensions.aepCapabilities[1].id, 'bb');
});

test('applyAepLock rejects malformed ids and hashes', () => {
    const manifest = {extensions: {aepCapabilities: []}};
    assert.throws(() => applyAepLock(manifest, '9bad', '0.1.0', 'd'.repeat(64), []), /AEP-LOCK-007/);
    assert.throws(() => applyAepLock(manifest, 'good', '0.1.0', 'short', []), /AEP-LOCK-006/);
});

test('verifyAepLockForAwp reads the AWP manifest and matches a freshly compiled AEP', () => {
    const dir = makeTempDir('lock-awp');
    try {
        const {awpPath, manifest} = buildExtensionAwp(dir);
        const aepPath = path.join(dir, 'output.aep');
        generateAep(awpPath, aepPath);
        const actual = sha256Hex(aepPath);
        applyAepLock(manifest, 'example-extension', '0.1.0', actual, []);
        const outPath = path.join(dir, 'project.locked.awp');
        const irCopy = {
            irVersion: 1,
            projectId: 'example-extension',
            workType: 'AprismExtension',
            target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
            capabilities: ['basic'],
            extension: {type: 'api-extension', aprismRange: '>=26.8.0'},
            declarations: [],
            handlers: []
        };
        writeAwp(outPath, {manifest, ir: JSON.parse(JSON.stringify(irCopy))});
        const result = verifyAepLockForAwp(aepPath, outPath);
        assert.equal(result.checked, true);
        assert.equal(result.matched, true);
        assert.equal(result.expected, actual);
        assert.equal(result.actual, actual);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('verifyAepLockForAwp flags a hash mismatch and exposes the AEP-LOCK-005 diagnostic', () => {
    const dir = makeTempDir('lock-awp-mismatch');
    try {
        const {awpPath, manifest} = buildExtensionAwp(dir);
        const aepPath = path.join(dir, 'output.aep');
        generateAep(awpPath, aepPath);
        applyAepLock(manifest, 'example-extension', '0.1.0', 'f'.repeat(64), []);
        const outPath = path.join(dir, 'project.locked.awp');
        const irCopy = {
            irVersion: 1,
            projectId: 'example-extension',
            workType: 'AprismExtension',
            target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
            capabilities: ['basic'],
            extension: {type: 'api-extension', aprismRange: '>=26.8.0'},
            declarations: [],
            handlers: []
        };
        writeAwp(outPath, {manifest, ir: JSON.parse(JSON.stringify(irCopy))});
        const result = verifyAepLockForAwp(aepPath, outPath);
        assert.equal(result.checked, true);
        assert.equal(result.matched, false);
        assert.ok(result.diagnostics.some(d => d.code === 'AEP-LOCK-005'));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('verifyAepLockForAwp reports an AEP-LOCK-011 diagnostic when the AWP cannot be read', () => {
    const result = verifyAepLockForAwp(path.join(os.tmpdir(), 'does-not-exist.aep'), path.join(os.tmpdir(), 'does-not-exist.awp'));
    assert.equal(result.checked, false);
    assert.equal(result.matched, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AEP-LOCK-011'));
});

test('verifyAepLockForAwp requires a non-empty AWP path', () => {
    const result = verifyAepLockForAwp(path.join(os.tmpdir(), 'whatever.aep'), '');
    assert.equal(result.checked, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AEP-LOCK-010'));
});
