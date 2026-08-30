'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {validate, validateFile} = require('../../src/schema/validate');

const schemaDir = path.join(__dirname, '..', '..', 'schemas');

test('AWP manifest schema accepts a minimal example', () => {
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
    const result = validateFile(path.join(schemaDir, 'awp.schema.json'), manifest);
    assert.equal(result.valid, true, 'minimal manifest must validate: ' + JSON.stringify(result.errors));
});

test('AWP manifest schema rejects malformed top-level fields via extensions lock', () => {
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
        source: {editor: 'aprismwarp-native', project: 'editor/project.json', ir: 'ir/project.json'},
        extensions: {aepCapabilities: [{id: 'demo', version: '1.0.0', sha256: 'not-hex'}]}
    };
    const result = validateFile(path.join(schemaDir, 'awp.schema.json'), manifest);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.code === 'SCHEMA-006' && e.path === 'extensions.aepCapabilities[0].sha256'));
});
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


test('IR schema accepts the bundled minimal example', () => {
    const ir = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', '..', 'examples', 'minimal.ir.json'),
        'utf8'
    ));
    const result = validateFile(path.join(schemaDir, 'ir.schema.json'), ir);
    assert.equal(result.valid, true, 'minimal IR must validate: ' + JSON.stringify(result.errors));
});

test('IR schema rejects an unknown declaration kind', () => {
    const ir = {
        irVersion: 1,
        projectId: 'demo',
        workType: 'AprismJEMod',
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        capabilities: ['basic'],
        declarations: [
            {nodeId: 'x', kind: 'mystery', declaration: 'item', id: 'demo:widget'}
        ],
        handlers: []
    };
    const result = validateFile(path.join(schemaDir, 'ir.schema.json'), ir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.code === 'SCHEMA-004' && e.path === 'declarations[0].kind'));
});

test('AEP editor schema accepts a valid manifest and rejects a malformed one', () => {
    const good = {
        schema: 'aprismwarp.aep-editor/v1',
        extensionId: 'example',
        requires: {aprismRange: '>=26.8.0', workTypes: ['AprismExtension']},
        capabilities: [
            {id: 'example:cap', kind: 'block-catalog', blocks: [
                {id: 'example:block', category: 'Examples', shape: 'statement', irKind: 'action', irOperation: 'example:do'}
            ]}
        ]
    };
    const ok = validateFile(path.join(schemaDir, 'aep-editor.schema.json'), good);
    assert.equal(ok.valid, true, JSON.stringify(ok.errors));
    const bad = JSON.parse(JSON.stringify(good));
    bad.capabilities[0].blocks[0].shape = 'circular';
    const fail = validateFile(path.join(schemaDir, 'aep-editor.schema.json'), bad);
    assert.equal(fail.valid, false);
    assert.ok(fail.errors.some(e => e.code === 'SCHEMA-003'));
});

