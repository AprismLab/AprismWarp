'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {sha256Hex, getAjeLocks, verifyAjeLock, verifyAjeLockForAwp, applyAjeLock} = require('../../src/extension/lock');
const {generateAje, generateAjeAndLock} = require('../../src/compile/aje');
const {inspectArchive, readAwp, writeAwp} = require('../../src/awp/archive');

function makeTempDir(label) {
    return fs.mkdtempSync(path.join(os.tmpdir(), `aprismwarp-${label}-`));
}

function buildModAwp(workspaceDir, overrides = {}) {
    const manifest = {
        format: 'aprismwarp-project',
        schemaVersion: 1,
        projectId: 'example-mod',
        name: 'Example Mod',
        workType: 'AprismJEMod',
        workProfile: {
            minecraftVersion: '26.2',
            aprismVersion: 'v26.8-Alpha.7',
            workType: 'AprismJEMod'
        },
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        source: {editor: 'aprismwarp-native', project: 'editor/project.json', ir: 'ir/project.json'}
    };
    const ir = {
        irVersion: 1,
        projectId: 'example-mod',
        workType: 'AprismJEMod',
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        capabilities: ['basic'],
        declarations: [],
        handlers: []
    };
    const editor = Object.assign({
        entrypoint: 'com.example.ExampleMod',
        displayName: 'Example Mod',
        description: 'A demonstration mod for tests.',
        version: '0.1.0',
        environment: '*',
        depends: {'example-dep': '>=1.0.0'}
    }, overrides.editor || {});
    const awpPath = path.join(workspaceDir, 'project.awp');
    const files = new Map([
        ['editor/project.json', Buffer.from(JSON.stringify(editor, null, 2) + '\n')],

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover



        ['build/mod.jar', Buffer.from('placeholder-mod-jar')]
    ]);
    writeAwp(awpPath, {manifest, ir, files});
    return {awpPath, manifest, ir, editor};
}

test('getAjeLocks returns an empty array when no locks are declared', () => {
    assert.deepEqual(getAjeLocks({}), []);
    assert.deepEqual(getAjeLocks({extensions: {}}), []);
});

test('getAjeLocks normalises hashes and skips malformed entries', () => {
    const manifest = {extensions: {ajeCapabilities: [
        {id: 'good', version: '1.0.0', sha256: 'ABCDEF' + '0'.repeat(58)},
        {id: '9bad', sha256: '00'.repeat(32)},
        {id: 'lower-only', sha256: 'not-a-hash'},
        null
    ]}};
    const locks = getAjeLocks(manifest);
    assert.equal(locks.length, 1);
    assert.equal(locks[0].id, 'good');
    assert.equal(locks[0].sha256, 'abcdef' + '0'.repeat(58));
});

test('verifyAjeLock returns no match when no locks are declared', () => {
    const dir = makeTempDir('lock-aje-nolocks');
    try {
        const {awpPath} = buildModAwp(dir);
        const ajePath = path.join(dir, 'output.aje');
        generateAje(awpPath, ajePath);
        const result = verifyAjeLock(ajePath, {extensions: {}});
        assert.equal(result.checked, false);
        assert.equal(result.matched, false);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('verifyAjeLock matches a freshly generated AJE after applyAjeLock', () => {
    const dir = makeTempDir('lock-aje-roundtrip');
    try {
        const {awpPath, manifest} = buildModAwp(dir);
        const ajePath = path.join(dir, 'output.aje');
        generateAje(awpPath, ajePath);
        const actual = sha256Hex(ajePath);
        applyAjeLock(manifest, 'example-mod', '0.1.0', actual, []);
        const result = verifyAjeLock(ajePath, manifest);
        assert.equal(result.checked, true);
        assert.equal(result.matched, true);
        assert.equal(result.expected, actual);


        assert.equal(result.actual, actual);
        assert.equal(result.lock.id, 'example-mod');
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('verifyAjeLock flags a hash mismatch', () => {
    const dir = makeTempDir('lock-aje-mismatch');
    try {
        const {awpPath, manifest} = buildModAwp(dir);
        const ajePath = path.join(dir, 'output.aje');
        generateAje(awpPath, ajePath);
        const wrong = 'a'.repeat(64);
        applyAjeLock(manifest, 'example-mod', '0.1.0', wrong, []);
        const result = verifyAjeLock(ajePath, manifest);
        assert.equal(result.checked, true);
        assert.equal(result.matched, false);
        assert.ok(result.diagnostics.some(d => d.code === 'AJE-LOCK-005'));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('verifyAjeLock warns when a lock id does not match the AJE mod id', () => {
    const dir = makeTempDir('lock-aje-id');
    try {
        const {awpPath, manifest} = buildModAwp(dir);
        const ajePath = path.join(dir, 'output.aje');
        generateAje(awpPath, ajePath);
        const actual = sha256Hex(ajePath);
        applyAjeLock(manifest, 'different-mod', '0.1.0', actual, []);
        const result = verifyAjeLock(ajePath, manifest);
        assert.equal(result.checked, true);
        assert.equal(result.matched, false);
        assert.ok(result.diagnostics.some(d => d.code === 'AJE-LOCK-004'));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('applyAjeLock updates an existing lock entry rather than duplicating it', () => {
    const manifest = {extensions: {ajeCapabilities: [
        {id: 'aa', version: '0.0.1', sha256: 'a'.repeat(64)},
        {id: 'bb', version: '0.0.1', sha256: 'b'.repeat(64)}
    ]}};
    applyAjeLock(manifest, 'aa', '0.2.0', 'c'.repeat(64), []);
    assert.equal(manifest.extensions.ajeCapabilities.length, 2);
    assert.equal(manifest.extensions.ajeCapabilities[0].id, 'aa');
    assert.equal(manifest.extensions.ajeCapabilities[0].sha256, 'c'.repeat(64));


    assert.equal(manifest.extensions.ajeCapabilities[0].version, '0.2.0');
    assert.equal(manifest.extensions.ajeCapabilities[1].id, 'bb');
});

test('applyAjeLock rejects malformed ids and hashes', () => {
    const manifest = {extensions: {ajeCapabilities: []}};
    assert.throws(() => applyAjeLock(manifest, '9bad', '0.1.0', 'd'.repeat(64), []), /AJE-LOCK-007/);
    assert.throws(() => applyAjeLock(manifest, 'good', '0.1.0', 'short', []), /AJE-LOCK-006/);
});

test('verifyAjeLockForAwp reads the AWP manifest and matches a freshly compiled AJE', () => {
    const dir = makeTempDir('lock-aje-awp');
    try {
        const {awpPath, manifest} = buildModAwp(dir);
        const ajePath = path.join(dir, 'output.aje');
        generateAje(awpPath, ajePath);
        const actual = sha256Hex(ajePath);
        applyAjeLock(manifest, 'example-mod', '0.1.0', actual, []);
        const outPath = path.join(dir, 'project.locked.awp');
        writeAwp(outPath, {manifest, ir: {irVersion: 1, projectId: 'example-mod', workType: 'AprismJEMod', target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'}, capabilities: ['basic'], declarations: [], handlers: []}});
        const result = verifyAjeLockForAwp(ajePath, outPath);
        assert.equal(result.checked, true);
        assert.equal(result.matched, true);
        assert.equal(result.expected, actual);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('verifyAjeLockForAwp flags a hash mismatch and exposes the AJE-LOCK-005 diagnostic', () => {
    const dir = makeTempDir('lock-aje-awp-mismatch');
    try {
        const {awpPath, manifest} = buildModAwp(dir);
        const ajePath = path.join(dir, 'output.aje');
        generateAje(awpPath, ajePath);
        applyAjeLock(manifest, 'example-mod', '0.1.0', 'f'.repeat(64), []);
        const outPath = path.join(dir, 'project.locked.awp');
        writeAwp(outPath, {manifest, ir: {irVersion: 1, projectId: 'example-mod', workType: 'AprismJEMod', target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'}, capabilities: ['basic'], declarations: [], handlers: []}});
        const result = verifyAjeLockForAwp(ajePath, outPath);
        assert.equal(result.checked, true);
        assert.equal(result.matched, false);
        assert.ok(result.diagnostics.some(d => d.code === 'AJE-LOCK-005'));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

    }
});

test('verifyAjeLockForAwp reports an AJE-LOCK-011 diagnostic when the AWP cannot be read', () => {
    const result = verifyAjeLockForAwp(path.join(os.tmpdir(), 'does-not-exist.aje'), path.join(os.tmpdir(), 'does-not-exist.awp'));
    assert.equal(result.checked, false);


    assert.equal(result.matched, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AJE-LOCK-011'));
});

test('verifyAjeLockForAwp requires a non-empty AWP path', () => {
    const result = verifyAjeLockForAwp(path.join(os.tmpdir(), 'whatever.aje'), '');
    assert.equal(result.checked, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AJE-LOCK-010'));
});

test('generateAjeAndLock backfills the SHA-256 lock and rewrites the AWP', () => {
    const dir = makeTempDir('lock-aje-backfill');
    try {
        const {awpPath} = buildModAwp(dir);
        const ajePath = path.join(dir, 'example-mod-0.1.0.aje');
        const result = generateAjeAndLock(awpPath, ajePath);
        assert.ok(result.lock, 'lock entry must be returned');
        assert.equal(result.lock.id, 'example-mod');
        assert.equal(result.lock.sha256.length, 64);
        assert.ok(result.manifest.extensions.ajeCapabilities.some(entry =>
            entry.id === 'example-mod' && entry.sha256 === result.lock.sha256));
        const reloaded = readAwp(awpPath);
        const stored = reloaded.manifest.extensions.ajeCapabilities.find(entry => entry.id === 'example-mod');
        assert.ok(stored, 'lock must be persisted in the rewritten AWP');
        assert.equal(stored.sha256, result.lock.sha256);
        const ajeBytes = fs.readFileSync(ajePath);
        assert.equal(result.lock.sha256, sha256Hex(ajeBytes));
        assert.ok(fs.existsSync(result.checksumsPath));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('generateAjeAndLock writes the locked AWP to a separate path when awpOutPath is given', () => {
    const dir = makeTempDir('lock-aje-out');
    try {
        const {awpPath} = buildModAwp(dir);
        const ajePath = path.join(dir, 'example-mod-0.1.0.aje');
        const outPath = path.join(dir, 'project.locked.awp');
        const original = fs.readFileSync(awpPath);
        generateAjeAndLock(awpPath, ajePath, {awpOutPath: outPath});
        assert.ok(fs.existsSync(outPath), 'locked AWP must exist at out path');
        assert.ok(fs.readFileSync(awpPath).equals(original), 'source AWP must remain unchanged');
        const reloaded = readAwp(outPath);
        assert.ok(reloaded.manifest.extensions.ajeCapabilities.some(entry => entry.id === 'example-mod'));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});


test('generateAjeAndLock returns the updated manifest without writing when updateAwp is false', () => {
    const dir = makeTempDir('lock-aje-dry');
    try {
        const {awpPath} = buildModAwp(dir);
        const ajePath = path.join(dir, 'example-mod-0.1.0.aje');
        const original = fs.readFileSync(awpPath);
        const result = generateAjeAndLock(awpPath, ajePath, {updateAwp: false});
        assert.ok(result.lock, 'lock must be returned even when dry run');
        assert.ok(fs.readFileSync(awpPath).equals(original), 'AWP must not be rewritten in dry run');
        assert.ok(result.manifest.extensions.ajeCapabilities.some(entry =>
            entry.id === 'example-mod' && entry.sha256 === result.lock.sha256));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

