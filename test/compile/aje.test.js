'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {generateAje, generateAjeAndLock, generateAjeAndBuild, produceModJar} = require('../../src/compile/aje');
const {inspectArchive, readAwp, writeAwp} = require('../../src/awp/archive');
const crypto = require('node:crypto');
const {isJavacAvailable, resolveAprismApiJar} = require('../../src/compile/java');

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
        declarations: [
            {nodeId: 'item-1', kind: 'declaration', declaration: 'item', id: 'example-mod:widget', maxStack: 16}
        ],
        handlers: [
            {nodeId: 'init-1', kind: 'event', event: 'lifecycle.init', body: [
                {nodeId: 'log-1', kind: 'action', action: 'log.info', message: 'init'}
            ]}
        ]
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
        ['build/mod.jar', Buffer.from('placeholder-mod-jar')],
        ['resources/assets/example-mod/lang/en_us.json', Buffer.from('{"item.example-mod.widget":"Widget"}')],
        ['mixins/example-mod.mixins.json', Buffer.from('{"required":{},"package":"com.example","compatibilityLevel":"JAVA_17"}')],
        ['lib/example-dep-1.0.0.jar', Buffer.from('placeholder-lib-jar')]
    ]);
    writeAwp(awpPath, {manifest, ir, files});
    return {awpPath, manifest, ir, editor, jarBytes: files.get('build/mod.jar')};
}

test('generates a deterministic .aje with manifest, mod jar, resources, mixins, lib, and checksums', () => {
    const dir = makeTempDir('aje-gen');
    try {
        const {awpPath, jarBytes} = buildModAwp(dir);
        const ajePath = path.join(dir, 'example-mod-0.1.0.aje');
        const first = generateAje(awpPath, ajePath);
        const second = generateAje(awpPath, ajePath);
        assert.equal(first.entries.sort().join(','), second.entries.sort().join(','));
        assert.ok(fs.readFileSync(ajePath).equals(fs.readFileSync(ajePath)));
        const files = inspectArchive(fs.readFileSync(ajePath));
        const manifest = JSON.parse(files.get('aprism.manifest.json').toString('utf8'));
        assert.equal(manifest.id, 'example-mod');
        assert.equal(manifest.version, '0.1.0');
        assert.equal(manifest.displayName, 'Example Mod');
        assert.deepEqual(manifest.entrypoints.main, ['com.example.ExampleMod']);
        assert.deepEqual(manifest.depends, {'example-dep': '>=1.0.0'});
        assert.equal(files.get('example-mod.jar').equals(jarBytes), true);
        assert.deepEqual(manifest.mixins, ['example-mod.mixins.json']);
        assert.equal(files.get('resources/assets/example-mod/lang/en_us.json').toString('utf8'),
            '{"item.example-mod.widget":"Widget"}');
        assert.equal(files.get('mixins/example-mod.mixins.json').toString('utf8')
            .includes('JAVA_17'), true);
        assert.equal(files.get('lib/example-dep-1.0.0.jar').equals(Buffer.from('placeholder-lib-jar')), true);
        const checksums = fs.readFileSync(ajePath + '.checksums.txt', 'utf8');
        assert.ok(checksums.includes('example-mod.jar'));
        assert.ok(checksums.includes('aprism.manifest.json'));
        assert.ok(checksums.includes('resources/assets/example-mod/lang/en_us.json'));
        const archiveBytes = fs.readFileSync(ajePath);
        const ajeFiles = inspectArchive(archiveBytes);
        const archiveDigest = crypto.createHash('sha256');
        for (const name of [...ajeFiles.keys()].sort()) {
            archiveDigest.update(ajeFiles.get(name));
        }
        const expectedHeader = `${archiveDigest.digest('hex')}  ${path.basename(ajePath)}`;
        assert.ok(checksums.includes(expectedHeader), 'checksums.txt must include the archive header digest');
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('rejects AprismExtension workType on the .awp project', () => {
    const dir = makeTempDir('aje-ext');
    try {
        const awpPath = path.join(dir, 'ext.awp');
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
        writeAwp(awpPath, {manifest, ir});
        assert.throws(() => generateAje(awpPath, path.join(dir, 'out.aje')), /AJE-COMPILE-001/);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('rejects an AWP without the pre-compiled mod JAR', () => {
    const dir = makeTempDir('aje-nojar');
    try {
        const {awpPath} = buildModAwp(dir);
        const project = readAwp(awpPath);
        project.files.delete('build/mod.jar');
        writeAwp(awpPath, project);
        assert.throws(() => generateAje(awpPath, path.join(dir, 'out.aje')), /AJE-COMPILE-030/);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('rejects an AWP whose editor metadata omits the entrypoint', () => {
    const dir = makeTempDir('aje-noentry');
    try {
        const {awpPath} = buildModAwp(dir, {editor: {displayName: 'X', description: 'Y', version: '0.1.0', entrypoint: ''}});
        assert.throws(() => generateAje(awpPath, path.join(dir, 'out.aje')), /AJE-COMPILE-015/);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('rejects an invalid environment value', () => {
    const dir = makeTempDir('aje-env');
    try {
        const {awpPath} = buildModAwp(dir, {editor: {environment: 'bespoke'}});
        assert.throws(() => generateAje(awpPath, path.join(dir, 'out.aje')), /AJE-COMPILE-014/);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('rejects resources that would collide with reserved archive sections', () => {
    const dir = makeTempDir('aje-collision');
    try {
        const {awpPath} = buildModAwp(dir);
        const project = readAwp(awpPath);
        // Reserved name that AWP writer accepts but AJE compiler must reject
        project.files.set('resources/aprismwarp.editor.json', Buffer.from('collision'));
        writeAwp(awpPath, project);
        assert.throws(() => generateAje(awpPath, path.join(dir, 'out.aje')), /AJE-COMPILE-032/);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('produceModJar returns a JAR buffer with the IAprismMod class when javac is available', {skip: !isJavacAvailable()}, () => {
    const apiJar = resolveAprismApiJar(__dirname);
    if (!apiJar) throw new Error('Aprism API jar not found; cannot run integration test');
    const dir = makeTempDir('aje-build');
    try {
        const {awpPath} = buildModAwp(dir);
        const result = produceModJar(awpPath, {apiJar});
        assert.ok(Buffer.isBuffer(result.modJar) && result.modJar.length > 0);
        assert.ok(typeof result.entryClass === 'string' && result.entryClass.length > 0);
        assert.ok(result.source.includes('implements IAprismMod'));
        const entries = inspectArchive(result.modJar);
        assert.ok(entries.get('META-INF/MANIFEST.MF'), 'expected JAR manifest');
        const classKey = result.entryClass.replace(/\./g, '/') + '.class';
        assert.ok(entries.get(classKey), 'expected class file ' + classKey + ' inside JAR');
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('generateAjeAndBuild produces a complete .aje when no pre-built mod jar is supplied', {skip: !isJavacAvailable()}, () => {
    const apiJar = resolveAprismApiJar(__dirname);
    if (!apiJar) throw new Error('Aprism API jar not found; cannot run integration test');
    const dir = makeTempDir('aje-build-end2end');
    try {
        const manifest = {
            format: 'aprismwarp-project',
            schemaVersion: 1,
            projectId: 'build-mod',
            name: 'Build Mod',
            workType: 'AprismJEMod',
            workProfile: {minecraftVersion: '26.2', aprismVersion: 'v26.8-Alpha.7', workType: 'AprismJEMod'},
            target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
            source: {editor: 'aprismwarp-native', project: 'editor/project.json', ir: 'ir/project.json'}
        };
        const ir = {
            irVersion: 1, projectId: 'build-mod', workType: 'AprismJEMod',
            target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
            capabilities: ['basic'],
            declarations: [
                {nodeId: 'item-1', kind: 'declaration', declaration: 'item', id: 'build-mod:widget', maxStack: 16}
            ],
            handlers: [
                {nodeId: 'init-1', kind: 'event', event: 'lifecycle.init', body: []}
            ]
        };
        const editor = {
            entrypoint: 'com.aprismwarp.generated.Build_modMod',
            displayName: 'Build Mod',
            description: 'Built mod',
            version: '0.1.0',
            environment: '*'
        };
        const awpPath = path.join(dir, 'build-mod.awp');
        writeAwp(awpPath, {manifest, ir, files: new Map([
            ['editor/project.json', Buffer.from(JSON.stringify(editor, null, 2))]
        ])});
        const ajePath = path.join(dir, 'build-mod.aje');
        const result = generateAjeAndBuild(awpPath, ajePath, {apiJar});
        assert.equal(result.built, true);
        const entries = inspectArchive(fs.readFileSync(ajePath));
        const modJar = entries.get('build-mod.jar');
        assert.ok(modJar && modJar.length > 0);
        const inner = inspectArchive(modJar);
        assert.ok(inner.get('com/aprismwarp/generated/Build_modMod.class'));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('generateAjeAndBuild reuses the pre-built mod jar when --build is not set', {skip: !isJavacAvailable()}, () => {
    const dir = makeTempDir('aje-build-skip');
    try {
        const {awpPath} = buildModAwp(dir);
        const ajePath = path.join(dir, 'out.aje');
        const project = readAwp(awpPath);
        const originalModJar = project.files.get('build/mod.jar');
        const result = generateAjeAndBuild(awpPath, ajePath);
        assert.equal(result.built, false);
        const entries = inspectArchive(fs.readFileSync(ajePath));
        assert.ok(entries.get('example-mod.jar').equals(originalModJar));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});
