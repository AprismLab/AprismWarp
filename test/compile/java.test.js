'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
    generateJavaSource,
    compileJava,
    jarJava,
    isJavacAvailable,
    resolveAprismApiJar,
    defaultEntryClassName
} = require('../../src/compile/java');
const {inspectArchive, readAwp, writeAwp} = require('../../src/awp/archive');
const {generateAjeAndLock} = require('../../src/compile/aje');

function makeTempDir(label) {
    return fs.mkdtempSync(path.join(os.tmpdir(), `aprismwarp-${label}-`));
}

function minimalIr(overrides = {}) {
    return Object.assign({
        irVersion: 1,
        projectId: 'demo-mod',
        workType: 'AprismJEMod',
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        capabilities: ['basic'],
        declarations: [
            {nodeId: 'item-widget', kind: 'declaration', declaration: 'item', id: 'demo-mod:widget', maxStack: 32}
        ],
        handlers: [
            {
                nodeId: 'init-handler',
                kind: 'event',
                event: 'lifecycle.init',
                body: [
                    {nodeId: 'startup-log', kind: 'action', action: 'log.info', message: 'hello'}
                ]
            },
            {
                nodeId: 'tick-end',
                kind: 'event',
                event: 'game.tick',
                stage: 'END',
                body: [
                    {nodeId: 'tick-log', kind: 'action', action: 'log.info', message: 'tick-end'}
                ]
            }

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

        ]
    }, overrides);
}

test('defaultEntryClassName produces a stable, package-friendly FQCN', () => {
    assert.equal(defaultEntryClassName('example-mod'), 'com.aprismwarp.generated.Example_modMod');
    assert.equal(defaultEntryClassName('bad id!'), 'com.aprismwarp.generated.Bad_id_Mod');
});

test('resolveAprismApiJar finds the local build jar from the workspace', () => {
    const jar = resolveAprismApiJar(__dirname);
    assert.ok(jar, 'expected an Aprism API jar to be discoverable');
    assert.ok(jar.endsWith('.jar'));
    assert.ok(jar.includes('aprism-api-'));
});

test('generateJavaSource emits the IAprismMod interface and the four lifecycle methods', () => {
    const source = generateJavaSource(minimalIr());
    assert.ok(source.includes('public final class Demo_modMod implements IAprismMod'));
    assert.ok(source.includes('public void onPreInitialize(AprismContext ctx)'));
    assert.ok(source.includes('public void onInitialize(AprismContext ctx)'));
    assert.ok(source.includes('public void onSetup(AprismContext ctx)'));
    assert.ok(source.includes('public void onComplete(AprismContext ctx)'));
    assert.ok(source.includes('ctx.getItemRegistry().register('));
    assert.ok(source.includes('ItemContent('));
    assert.ok(source.includes('ctx.getLogger().info("hello")'));
    assert.ok(source.includes('ctx.getEventBus().register(GameTickEvent.class,'));
    assert.ok(source.includes('event.getStage() != GameTickEvent.Stage.END'));
    assert.ok(source.includes('private void onTickTick_end(GameTickEvent event)'));
});

test('generateJavaSource emits preview-only action comments and skips unsupported ops', () => {
    const source = generateJavaSource(minimalIr({
        handlers: [
            {
                nodeId: 'preview',
                kind: 'event',
                event: 'lifecycle.init',
                body: [
                    {nodeId: 'a1', kind: 'action', action: 'schedule.once', delayTicks: 20, previewOnly: true},
                    {nodeId: 'a2', kind: 'action', action: 'mystery', payload: 'x'}
                ]
            }
        ]
    }));
    assert.ok(source.includes('// preview-only: schedule.once (export blocked in IR v0.1)'));
    assert.ok(source.includes('// unsupported action: mystery'));
});

test('generateJavaSource omits resource paths and other unsupported declarations gracefully', () => {

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

    const source = generateJavaSource(minimalIr({
        declarations: [
            {nodeId: 'r1', kind: 'declaration', declaration: 'resource', id: 'r1'}
        ]
    }));
    assert.ok(source.includes('// resource: r1'));
});

test('compileJava + jarJava produce a loadable IAprismMod class when javac is available', {skip: !isJavacAvailable()}, () => {
    const apiJar = resolveAprismApiJar(__dirname);
    if (!apiJar) throw new Error('Aprism API jar not found; cannot run integration test');
    const dir = makeTempDir('java-compile');
    try {
        const source = generateJavaSource(minimalIr());
        const classDir = path.join(dir, 'classes');
        const classResult = compileJava(source, classDir, {apiClasspath: apiJar});
        assert.ok(classResult.classFiles.length > 0, 'at least one .class file produced');
        assert.ok(classResult.classFiles[0].endsWith('Demo_modMod.class'));
        const jarPath = path.join(dir, 'mod.jar');
        const jarResult = jarJava(classDir, jarPath, {entryClass: 'com.aprismwarp.generated.Demo_modMod'});
        assert.ok(fs.existsSync(jarPath));
        assert.ok(jarResult.entries.includes('META-INF/MANIFEST.MF'));
        const entries = inspectArchive(fs.readFileSync(jarPath));
        const manifestBytes = entries.get('META-INF/MANIFEST.MF');
        assert.ok(manifestBytes.toString('utf8').includes('Main-Class: com.aprismwarp.generated.Demo_modMod'));
        const classBytes = entries.get('com/aprismwarp/generated/Demo_modMod.class');
        assert.ok(classBytes && classBytes.length > 0);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('end-to-end: AWP with Java generator produces a loadable .aje', {skip: !isJavacAvailable()}, () => {
    const apiJar = resolveAprismApiJar(__dirname);
    if (!apiJar) throw new Error('Aprism API jar not found; cannot run integration test');
    const dir = makeTempDir('java-awe-e2e');
    try {
        const awpPath = path.join(dir, 'mod.awp');
        const ajePath = path.join(dir, 'mod.aje');
        const manifest = {
            format: 'aprismwarp-project',
            schemaVersion: 1,
            projectId: 'e2e-mod',
            name: 'E2E Mod',
            workType: 'AprismJEMod',
            workProfile: {minecraftVersion: '26.2', aprismVersion: 'v26.8-Alpha.7', workType: 'AprismJEMod'},
            target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
            source: {editor: 'aprismwarp-native', project: 'editor/project.json', ir: 'ir/project.json'}
        };
        const ir = minimalIr({projectId: 'e2e-mod'});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

        ir.target = {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'};
        const editor = {
            entrypoint: 'com.aprismwarp.generated.E2e_modMod',
            displayName: 'E2E Mod',
            description: 'End-to-end',
            version: '0.1.0',
            environment: '*'
        };
        const source = generateJavaSource(ir, {entryClass: editor.entrypoint});
        const classDir = path.join(dir, 'classes');
        compileJava(source, classDir, {apiClasspath: apiJar});
        const modJarPath = path.join(dir, 'e2e-mod.jar');
        jarJava(classDir, modJarPath);
        const files = new Map();
        files.set('editor/project.json', Buffer.from(JSON.stringify(editor, null, 2)));
        files.set('build/mod.jar', fs.readFileSync(modJarPath));
        writeAwp(awpPath, {manifest, ir, files});
        generateAjeAndLock(awpPath, ajePath);
        const ajeFiles = inspectArchive(fs.readFileSync(ajePath));
        const modJarEntry = ajeFiles.get('e2e-mod.jar');
        assert.ok(modJarEntry && modJarEntry.length > 0);
        const innerEntries = inspectArchive(modJarEntry);
        const classEntry = innerEntries.get('com/aprismwarp/generated/E2e_modMod.class');
        assert.ok(classEntry && classEntry.length > 0);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});
