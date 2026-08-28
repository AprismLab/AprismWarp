'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {readAwp, writeAwp, inspectArchive} = require('../../src/awp/archive');

function project() {
    return {
        manifest: {
            format: 'aprismwarp-project',
            schemaVersion: 1,
            projectId: 'examplemod',
            name: 'Example Mod',
            workType: 'AprismJEMod',
            workProfile: {
                minecraftVersion: '26.2',
                aprismVersion: 'v26.8-Alpha.7',
                workType: 'AprismJEMod'
            },
            target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
            source: {
                editor: 'aprismwarp-native',
                project: 'editor/project.json',
                ir: 'ir/project.json'
            },
            customField: {preserve: true}
        },
        ir: {
            irVersion: 1,
            projectId: 'examplemod',
            workType: 'AprismJEMod',
            target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
            capabilities: ['basic'],
            declarations: [],
            handlers: []
        },
        files: new Map([
            ['editor/project.json', Buffer.from('{"selected":"block-1"}\n')],
            ['resources/example.txt', Buffer.from('example')]
        ])
    };
}

test('writes and reads a deterministic AWP archive', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aprismwarp-awp-'));
    const first = path.join(dir, 'first.awp');
    const second = path.join(dir, 'second.awp');
    const data = project();

    writeAwp(first, data);
    const loaded = readAwp(first);
    writeAwp(second, loaded);

    assert.deepEqual(loaded.manifest, data.manifest);
    assert.deepEqual(loaded.ir, data.ir);
    assert.deepEqual(loaded.files.get('resources/example.txt'), Buffer.from('example'));
    assert.deepEqual(fs.readFileSync(first), fs.readFileSync(second));
    fs.rmSync(dir, {recursive: true, force: true});
});

test('rejects AWP and IR work type mismatch', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aprismwarp-awp-'));
    const file = path.join(dir, 'mismatch.awp');
    const data = project();
    data.ir.workType = 'AprismExtension';

    assert.throws(() => writeAwp(file, data), /AWP-MANIFEST-002/);
    fs.rmSync(dir, {recursive: true, force: true});
});

test('rejects unsafe and duplicate archive entries before JSON parsing', () => {
    const unsafe = makeStoredZip([
        ['../escape.txt', Buffer.from('no')],
        ['awp.json', Buffer.from('{}')]
    ]);
    assert.throws(() => inspectArchive(unsafe), /AWP-ARCHIVE-012/);

    const duplicate = makeStoredZip([
        ['awp.json', Buffer.from('{}')],
        ['awp.json', Buffer.from('{}')]
    ]);
    assert.throws(() => inspectArchive(duplicate), /AWP-ARCHIVE-012/);
});

test('rejects invalid target profile even when archive structure is valid', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aprismwarp-awp-'));
    const file = path.join(dir, 'invalid.awp');
    const data = project();
    data.manifest.target.minecraft = '26.1';

    assert.throws(() => writeAwp(file, data), /AWP-MANIFEST-004/);
    fs.rmSync(dir, {recursive: true, force: true});
});

function makeStoredZip(entries) {
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
    return Buffer.concat([...locals, directory, eocd]);
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
