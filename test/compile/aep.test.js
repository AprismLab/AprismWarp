'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {generateAep, generateAepAndLock} = require('../../src/compile/aep');
const {inspectArchive, readAwp, writeAwp} = require('../../src/awp/archive');

function buildAwpFixture(workspaceDir) {
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
        source: {
            editor: 'aprismwarp-native',
            project: 'editor/project.json',
            ir: 'ir/project.json'
        }
    };
    const ir = {
        irVersion: 1,
        projectId: 'example-extension',
        workType: 'AprismExtension',
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        capabilities: ['basic'],
        extension: {
            type: 'api-extension',
            aprismRange: '>=26.8.0',
            provides: ['example:capability'],
            depends: {'other-extension': '>=1.0.0'},
            priority: 5
        },
        declarations: [],
        handlers: []
    };
    const editor = {
        entrypoint: 'com.example.MyExtension',
        displayName: 'Example Extension',
        description: 'A demonstration extension for tests.',
        version: '0.1.0'
    };
    const jarBytes = Buffer.from('placeholder-extension-jar');
    const awpPath = path.join(workspaceDir, 'project.awp');
    writeStoredZip(awpPath, [
        ['awp.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n')],
        ['ir/project.json', Buffer.from(JSON.stringify(ir, null, 2) + '\n')],
        ['editor/project.json', Buffer.from(JSON.stringify(editor, null, 2) + '\n')],
        ['build/extension.jar', jarBytes]
    ]);
    return {awpPath, jarBytes};
}

function writeStoredZip(zipPath, entries) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const [name, data] of entries) {
        const nameBytes = Buffer.from(name);
        const local = Buffer.alloc(30 + nameBytes.length);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt32LE(crc32(data), 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        nameBytes.copy(local, 30);
        locals.push(local, data);

        const central = Buffer.alloc(46 + nameBytes.length);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt32LE(crc32(data), 16);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBytes.length, 28);
        central.writeUInt32LE(offset, 42);
        nameBytes.copy(central, 46);
        centrals.push(central);
        offset += local.length + data.length;
    }
    const directory = Buffer.concat(centrals);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(directory.length, 12);
    eocd.writeUInt32LE(offset, 16);
    fs.writeFileSync(zipPath, Buffer.concat([...locals, directory, eocd]));
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

function readAepEntry(aepPath, name) {
    const files = inspectArchive(fs.readFileSync(aepPath));
    return files.get(name);
}

function buildMinimalModAwp(workspaceDir) {
    const awpPath = path.join(workspaceDir, 'mod.awp');
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
    writeStoredZip(awpPath, [
        ['awp.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n')],
        ['ir/project.json', Buffer.from(JSON.stringify(ir, null, 2) + '\n')]
    ]);
    return awpPath;
}

function buildMissingEntrypointAwp(workspaceDir) {
    const awpPath = path.join(workspaceDir, 'project.awp');
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
    writeStoredZip(awpPath, [
        ['awp.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n')],
        ['ir/project.json', Buffer.from(JSON.stringify(ir, null, 2) + '\n')],
        ['editor/project.json', Buffer.from('{"displayName":"X","description":"Y"}\n')],
        ['build/extension.jar', Buffer.from('jar')]
    ]);
    return awpPath;
}

function buildMissingJarAwp(workspaceDir) {
    const awpPath = path.join(workspaceDir, 'project.awp');
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
    writeStoredZip(awpPath, [
        ['awp.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n')],
        ['ir/project.json', Buffer.from(JSON.stringify(ir, null, 2) + '\n')],
        ['editor/project.json', Buffer.from('{"entrypoint":"com.example.X","displayName":"X","description":"Y"}\n')]
    ]);
    return awpPath;
}

test('generates a deterministic AEP and round-trips through readAwp', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aprismwarp-aep-gen-'));
    try {
        const {awpPath, jarBytes} = buildAwpFixture(dir);
        const aepPath = path.join(dir, 'build', 'output.aep');
        generateAep(awpPath, aepPath);
        const manifestBytes = readAepEntry(aepPath, 'aprism.extension.json');
        const jarEntry = readAepEntry(aepPath, 'build/extension.jar');
        const manifest = JSON.parse(manifestBytes.toString('utf8'));
        assert.equal(manifest.extensionId, 'example-extension');
        assert.equal(manifest.type, 'api-extension');
        assert.equal(manifest.entrypoint, 'com.example.MyExtension');
        assert.equal(manifest.aprismRange, '>=26.8.0');
        assert.equal(manifest.priority, 5);
        assert.deepEqual(manifest.provides, ['example:capability']);
        assert.deepEqual(manifest.depends, {'other-extension': '>=1.0.0'});
        assert.ok(jarEntry);
        assert.ok(jarEntry.equals(jarBytes));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('two compilations produce identical AEP bytes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aprismwarp-aep-det-'));
    try {
        const {awpPath} = buildAwpFixture(dir);
        const aep1 = path.join(dir, 'first.aep');
        const aep2 = path.join(dir, 'second.aep');
        generateAep(awpPath, aep1);
        generateAep(awpPath, aep2);
        assert.ok(fs.readFileSync(aep1).equals(fs.readFileSync(aep2)));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('rejects an AWP whose workType is not AprismExtension', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aprismwarp-aep-wrong-'));
    try {
        const awpPath = buildMinimalModAwp(dir);
        assert.throws(
            () => generateAep(awpPath, path.join(dir, 'output.aep')),
            /AWP-COMPILE-001/
        );
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('rejects an AWP whose editor metadata omits the entrypoint', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aprismwarp-aep-noentry-'));
    try {
        const awpPath = buildMissingEntrypointAwp(dir);
        assert.throws(
            () => generateAep(awpPath, path.join(dir, 'output.aep')),
            /AWP-COMPILE-002/
        );
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('rejects an AWP missing the pre-compiled extension JAR', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aprismwarp-aep-nojar-'));
    try {
        const awpPath = buildMissingJarAwp(dir);
        assert.throws(
            () => generateAep(awpPath, path.join(dir, 'output.aep')),
            /AWP-COMPILE-006/
        );
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('generateAepAndLock backfills the SHA-256 lock and rewrites the AWP', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aprismwarp-aep-lock-'));
    try {
        const {awpPath} = buildAwpFixture(dir);
        const aepPath = path.join(dir, 'output.aep');
        const result = generateAepAndLock(awpPath, aepPath);
        assert.ok(result.lock, 'lock entry must be returned');
        assert.equal(result.lock.id, 'example-extension');
        assert.equal(result.lock.sha256.length, 64);
        assert.ok(result.manifest.extensions.aepCapabilities.some(entry =>
            entry.id === 'example-extension' && entry.sha256 === result.lock.sha256));
        const reloaded = readAwp(awpPath);
        const stored = reloaded.manifest.extensions.aepCapabilities.find(entry => entry.id === 'example-extension');
        assert.ok(stored, 'lock must be persisted in the rewritten AWP');
        assert.equal(stored.sha256, result.lock.sha256);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('generateAepAndLock records capabilities from the editor manifest', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aprismwarp-aep-cap-'));
    try {
        const {awpPath} = buildAwpFixture(dir);
        // Rewrite the AWP so it carries an aprismwarp.editor.json with capabilities
        const project = readAwp(awpPath);
        const editor = JSON.parse(project.files.get('editor/project.json').toString('utf8'));
        const aepManifest = {
            schema: 'aprismwarp.aep-editor/v1',
            extensionId: project.manifest.projectId,
            requires: {aprismRange: '>=26.8.0', workTypes: ['AprismExtension']},
            capabilities: [
                {id: 'example-extension:capability-a', kind: 'block-catalog', blocks: []},
                {id: 'example-extension:capability-b', kind: 'block-catalog', blocks: []}
            ]
        };
        project.files.set(
            'aprismwarp.editor.json',
            Buffer.from(JSON.stringify(aepManifest, null, 2) + '\n')
        );
        writeAwp(awpPath, project);
        const aepPath = path.join(dir, 'output.aep');
        const result = generateAepAndLock(awpPath, aepPath);
        assert.deepEqual(result.lock.capabilities, [
            'example-extension:capability-a',
            'example-extension:capability-b'
        ]);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('generateAepAndLock writes the locked AWP to a separate path when awpOutPath is given', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aprismwarp-aep-out-'));
    try {
        const {awpPath} = buildAwpFixture(dir);
        const aepPath = path.join(dir, 'output.aep');
        const outPath = path.join(dir, 'project.locked.awp');
        const original = fs.readFileSync(awpPath);
        generateAepAndLock(awpPath, aepPath, {awpOutPath: outPath});
        assert.ok(fs.existsSync(outPath), 'locked AWP must exist at out path');
        assert.ok(fs.readFileSync(awpPath).equals(original), 'source AWP must remain unchanged');
        const reloaded = readAwp(outPath);
        assert.ok(reloaded.manifest.extensions.aepCapabilities.some(entry => entry.id === 'example-extension'));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('generateAepAndLock returns the updated manifest without writing when updateAwp is false', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aprismwarp-aep-dry-'));
    try {
        const {awpPath} = buildAwpFixture(dir);
        const aepPath = path.join(dir, 'output.aep');
        const original = fs.readFileSync(awpPath);
        const result = generateAepAndLock(awpPath, aepPath, {updateAwp: false});
        assert.ok(result.lock, 'lock must be returned even when dry run');
        assert.ok(fs.readFileSync(awpPath).equals(original), 'AWP must not be rewritten in dry run');
        assert.ok(result.manifest.extensions.aepCapabilities.some(entry =>
            entry.id === 'example-extension' && entry.sha256 === result.lock.sha256));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});
