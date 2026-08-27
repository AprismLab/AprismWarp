'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const zlib = require('node:zlib');

const {inspectAep} = require('../../src/aep/inspect');

function zip(entries) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const [name, value] of entries) {
        const nameBytes = Buffer.from(name);
        const raw = Buffer.from(value);
        const data = zlib.deflateRawSync(raw);
        const local = Buffer.alloc(30 + nameBytes.length);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(8, 8);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(raw.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        nameBytes.copy(local, 30);
        locals.push(local, data);

        const central = Buffer.alloc(46 + nameBytes.length);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(8, 10);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(raw.length, 24);
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
    return Buffer.concat([...locals, directory, eocd]);
}

const manifest = {
    schema: 'aprismwarp.aep-editor/v1',
    extensionId: 'example-registry',
    requires: {aprismRange: '>=26.8.0', workTypes: ['AprismJEMod']},
    capabilities: [{
        id: 'example-registry:custom-content',
        kind: 'block-catalog',
        blocks: [{
            id: 'example-registry:register-item',
            category: 'Example',
            shape: 'statement',
            irKind: 'declaration',
            irOperation: 'example-registry:custom-content',
            fields: [{id: 'name', type: 'resource-key'}]
        }]
    }]
};

test('inspects a valid editor manifest without executing runtime entries', () => {
    const file = path.join(process.env.TEMP || process.cwd(), 'valid-editor.aep');
    fs.writeFileSync(file, zip([
        ['aprism.extension.json', '{}'],
        ['aprismwarp.editor.json', JSON.stringify(manifest)],
        ['extension.jar', 'this must never be executed']
    ]));
    const result = inspectAep(file);
    assert.equal(result.valid, true);
    assert.equal(result.blocks.length, 1);
    assert.equal(result.blocks[0].id, 'example-registry:register-item');
    fs.rmSync(file, {force: true});
});

test('legacy AEP remains valid but exposes no editor blocks', () => {
    const file = path.join(process.env.TEMP || process.cwd(), 'legacy.aep');
    fs.writeFileSync(file, zip([['aprism.extension.json', '{}']]));
    const result = inspectAep(file);
    assert.equal(result.valid, true);
    assert.deepEqual(result.blocks, []);
    fs.rmSync(file, {force: true});
});

test('rejects duplicate block ids and unsafe archive paths', () => {
    const file = path.join(process.env.TEMP || process.cwd(), 'hostile-editor.aep');
    const duplicate = structuredClone(manifest);
    duplicate.capabilities[0].blocks.push({...duplicate.capabilities[0].blocks[0]});
    fs.writeFileSync(file, zip([
        ['aprismwarp.editor.json', JSON.stringify(duplicate)],
        ['../escape.txt', 'blocked']
    ]));
    const result = inspectAep(file);
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.some(item => item.code === 'AEP-ARCHIVE-007'));
    assert.ok(result.diagnostics.some(item => item.code === 'AEP-EDITOR-009'));
    fs.rmSync(file, {force: true});
});

test('rejects malformed editor JSON and oversized manifests', () => {
    const bad = path.join(process.env.TEMP || process.cwd(), 'bad-editor.aep');
    fs.writeFileSync(bad, zip([['aprismwarp.editor.json', '{bad json']]));
    assert.equal(inspectAep(bad).valid, false);
    fs.writeFileSync(bad, zip([['aprismwarp.editor.json', 'x'.repeat(1024 * 1024 + 1)]]));
    assert.ok(inspectAep(bad).diagnostics.some(item => item.code === 'AEP-EDITOR-011'));
    fs.rmSync(bad, {force: true});
});
