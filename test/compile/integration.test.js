'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {generateAep, generateAepAndLock} = require('../../src/compile/aep');
const {generateAje, generateAjeAndLock} = require('../../src/compile/aje');
const {inspectArchive, readAwp, writeAwp} = require('../../src/awp/archive');
const {verifyAepLockForAwp, verifyAjeLockForAwp} = require('../../src/extension/lock');

function makeTempDir(label) {
    return fs.mkdtempSync(path.join(os.tmpdir(), `aprismwarp-${label}-`));
}

function buildExtensionAwp(workspaceDir, name = 'example-extension', overrides = {}) {
    const manifest = {
        format: 'aprismwarp-project',
        schemaVersion: 1,
        projectId: name,
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
        projectId: name,
        workType: 'AprismExtension',
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        capabilities: ['basic'],
        extension: Object.assign({type: 'api-extension', aprismRange: '>=26.8.0'}, overrides.extension || {}),
        declarations: [],
        handlers: []
    };
    const editor = Object.assign({
        entrypoint: 'com.example.MyExtension',
        displayName: 'Example Extension',
        description: 'A demonstration extension for tests.',
        version: '0.1.0'
    }, overrides.editor || {});
    const awpPath = path.join(workspaceDir, `${name}.awp`);
    const files = new Map([
        ['editor/project.json', Buffer.from(JSON.stringify(editor, null, 2) + '\n')],
        ['build/extension.jar', Buffer.from('placeholder-extension-jar')]
    ]);
    if (overrides.editorCatalog) {
        files.set('aprismwarp.editor.json', Buffer.from(JSON.stringify(overrides.editorCatalog, null, 2) + '\n'));
    }
    writeAwp(awpPath, {manifest, ir, files});
    return {awpPath, manifest, ir, editor};
}

function buildModAwp(workspaceDir, name = 'example-mod', overrides = {}) {
    const manifest = {
        format: 'aprismwarp-project',
        schemaVersion: 1,
        projectId: name,
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
        projectId: name,
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
    const awpPath = path.join(workspaceDir, `${name}.awp`);
    const files = new Map([
        ['editor/project.json', Buffer.from(JSON.stringify(editor, null, 2) + '\n')],
        ['build/mod.jar', Buffer.from('placeholder-mod-jar')]
    ]);
    writeAwp(awpPath, {manifest, ir, files});
    return {awpPath, manifest, ir, editor};
}

test('dual-format workspace: extension and mod AWP both compile to their respective formats', () => {
    const dir = makeTempDir('integ-dual');
    try {
        const ext = buildExtensionAwp(dir, 'example-extension');
        const mod = buildModAwp(dir, 'example-mod');
        const aepPath = path.join(dir, 'out.aep');
        const ajePath = path.join(dir, 'out.aje');
        const aepResult = generateAepAndLock(ext.awpPath, aepPath);
        const ajeResult = generateAjeAndLock(mod.awpPath, ajePath);
        assert.ok(fs.existsSync(aepPath), 'AEP must be written');
        assert.ok(fs.existsSync(ajePath), 'AJE must be written');
        assert.notEqual(aepResult.lock.sha256, ajeResult.lock.sha256, 'AEP and AJE hashes must differ');
        assert.equal(aepResult.lock.id, 'example-extension');
        assert.equal(ajeResult.lock.id, 'example-mod');
        const aepFiles = inspectArchive(fs.readFileSync(aepPath));
        const ajeFiles = inspectArchive(fs.readFileSync(ajePath));
        assert.ok(aepFiles.get('aprism.extension.json'));
        assert.ok(ajeFiles.get('aprism.manifest.json'));
        assert.equal(inspectArchive(fs.readFileSync(ajePath)).get('example-mod.jar').equals(Buffer.from('placeholder-mod-jar')), true);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('cross-format compile protection: AEP compiler refuses AJE AWP and vice versa', () => {
    const dir = makeTempDir('integ-cross');
    try {
        const ext = buildExtensionAwp(dir, 'example-extension');
        const mod = buildModAwp(dir, 'example-mod');
        assert.throws(() => generateAep(mod.awpPath, path.join(dir, 'mod.aep')), /AWP-COMPILE-001/);
        assert.throws(() => generateAje(ext.awpPath, path.join(dir, 'ext.aje')), /AJE-COMPILE-001/);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('lock coexistence: a project manifest accepts both aepCapabilities and ajeCapabilities', () => {
    const dir = makeTempDir('integ-lock');
    try {
        const ext = buildExtensionAwp(dir, 'example-extension', {
            editorCatalog: {
                schema: 'aprismwarp.aep-editor/v1',
                extensionId: 'example-extension',
                requires: {aprismRange: '>=26.8.0', workTypes: ['AprismExtension']},
                capabilities: [
                    {id: 'example-extension:cap-a', kind: 'block-catalog', blocks: []},
                    {id: 'example-extension:cap-b', kind: 'block-catalog', blocks: []}
                ]
            }
        });
        const mod = buildModAwp(dir, 'example-mod');
        const aepPath = path.join(dir, 'example-extension.aep');
        const ajePath = path.join(dir, 'example-mod.aje');
        const aepResult = generateAepAndLock(ext.awpPath, aepPath);
        const ajeResult = generateAjeAndLock(mod.awpPath, ajePath);
        const extReload = readAwp(ext.awpPath);
        const modReload = readAwp(mod.awpPath);
        assert.deepEqual(extReload.manifest.extensions.aepCapabilities, [aepResult.lock]);
        assert.ok(
            !Array.isArray(extReload.manifest.extensions.ajeCapabilities) ||
            extReload.manifest.extensions.ajeCapabilities.length === 0,
            'extension AWP must not have aje capabilities'
        );
        assert.ok(
            !Array.isArray(modReload.manifest.extensions.aepCapabilities) ||
            modReload.manifest.extensions.aepCapabilities.length === 0,
            'mod AWP must not have aep capabilities'
        );
        assert.deepEqual(modReload.manifest.extensions.ajeCapabilities, [ajeResult.lock]);
        const aepLock = verifyAepLockForAwp(aepPath, ext.awpPath);
        const ajeLock = verifyAjeLockForAwp(ajePath, mod.awpPath);
        assert.equal(aepLock.matched, true);
        assert.equal(ajeLock.matched, true);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('AEP editor catalog capability ids propagate to the lock entry', () => {
    const dir = makeTempDir('integ-cap');
    try {
        const ext = buildExtensionAwp(dir, 'example-extension', {
            editorCatalog: {
                schema: 'aprismwarp.aep-editor/v1',
                extensionId: 'example-extension',
                requires: {aprismRange: '>=26.8.0', workTypes: ['AprismExtension']},
                capabilities: [
                    {id: 'example-extension:registry', kind: 'block-catalog', blocks: []}
                ]
            }
        });
        const aepPath = path.join(dir, 'out.aep');
        const result = generateAepAndLock(ext.awpPath, aepPath);
        assert.deepEqual(result.lock.capabilities, ['example-extension:registry']);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('AJE compile preserves unrelated manifest fields after round-trip', () => {
    const dir = makeTempDir('integ-preserve');
    try {
        const mod = buildModAwp(dir, 'example-mod', {
            editor: {
                customEditorField: 'preserve-me',
                customArray: [1, 2, 3]
            }
        });
        const ajePath = path.join(dir, 'out.aje');
        generateAjeAndLock(mod.awpPath, ajePath);
        const reloaded = readAwp(mod.awpPath);
        assert.equal(reloaded.manifest.workType, 'AprismJEMod');
        assert.equal(reloaded.manifest.projectId, 'example-mod');
        assert.equal(reloaded.manifest.target.minecraft, '26.2');
        assert.equal(reloaded.ir.capabilities[0], 'basic');
        assert.ok(reloaded.manifest.extensions.ajeCapabilities);
        assert.equal(reloaded.manifest.extensions.ajeCapabilities[0].id, 'example-mod');
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('AEP and AJE compiles are deterministic across runs', () => {
    const dir = makeTempDir('integ-det');
    try {
        const ext = buildExtensionAwp(dir, 'example-extension');
        const mod = buildModAwp(dir, 'example-mod');
        const aepPath1 = path.join(dir, 'a1.aep');
        const aepPath2 = path.join(dir, 'a2.aep');
        const ajePath1 = path.join(dir, 'b1.aje');
        const ajePath2 = path.join(dir, 'b2.aje');
        generateAepAndLock(ext.awpPath, aepPath1);
        generateAepAndLock(ext.awpPath, aepPath2);
        generateAjeAndLock(mod.awpPath, ajePath1);
        generateAjeAndLock(mod.awpPath, ajePath2);
        assert.ok(fs.readFileSync(aepPath1).equals(fs.readFileSync(aepPath2)),
            'AEP builds must be byte-identical');
        assert.ok(fs.readFileSync(ajePath1).equals(fs.readFileSync(ajePath2)),
            'AJE builds must be byte-identical');
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});
