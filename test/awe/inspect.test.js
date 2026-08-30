'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const {inspectAwe, configureAweSchemaPath} = require('../../src/awe/inspect');

const repoRoot = path.resolve(__dirname, '..', '..');
configureAweSchemaPath(path.join(repoRoot, 'schemas', 'awe.schema.json'));

// Minimal stored-entry ZIP writer for fixtures.
function buildAwe(manifest, extraEntries = []) {
    const chunks = [];
    const central = [];
    let offset = 0;
    const put = (name, data) => {
        const nameBytes = Buffer.from(name, 'utf8');
        const crcTable = [];
        for (let n = 0; n < 256; n += 1) {
            let c = n;
            for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            crcTable[n] = c >>> 0;
        }
        let crc = 0xffffffff;
        for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
        crc = (crc ^ 0xffffffff) >>> 0;
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(0, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        chunks.push(local, nameBytes, data);
        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(data.length, 20);
        centralHeader.writeUInt32LE(data.length, 24);
        centralHeader.writeUInt16LE(nameBytes.length, 28);
        centralHeader.writeUInt32LE(offset, 42);
        central.push(centralHeader, nameBytes);
        offset += 30 + nameBytes.length + data.length;
    };
    if (manifest !== null) put('aprismwarp.extension.json', Buffer.from(JSON.stringify(manifest)));
    for (const [name, data] of extraEntries) {
        put(name, typeof data === 'string' ? Buffer.from(data) : data);
    }
    const centralStart = offset;
    let centralSize = 0;
    for (const chunk of central) centralSize += chunk.length;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(central.length / 2, 8);
    eocd.writeUInt16LE(central.length / 2, 10);
    eocd.writeUInt32LE(centralSize, 12);
    eocd.writeUInt32LE(centralStart, 16);
    return Buffer.concat([...chunks, ...central, eocd]);
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const validManifest = {
    schema: 'aprismwarp.extension/v1',
    id: 'java-inspector',
    version: '1.0.0',
    name: 'Java Inspector',
    description: 'Shows generated Java source.',
    permissions: ['editor.blocks', 'project.read'],
    contributes: {
        blocks: 'blocks.json'
    }
};

function writeTemp(buffer) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awe-test-'));
    const file = path.join(dir, 'extension.awe');
    fs.writeFileSync(file, buffer);
    return file;
}

test('inspects a valid AWE with blocks contribution', () => {
    const file = writeTemp(buildAwe(validManifest, [
        ['blocks.json', JSON.stringify({blocks: [{id: 'demo:log'}]})]
    ]));
    const result = inspectAwe(file);
    assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
    assert.equal(result.manifest.id, 'java-inspector');
    assert.deepEqual(result.blocks, {blocks: [{id: 'demo:log'}]});
    assert.equal(result.runtimeEntry, null);
    fs.rmSync(path.dirname(file), {recursive: true, force: true});
});

test('rejects an AWE whose manifest is missing', () => {
    const file = writeTemp(buildAwe(null));
    const result = inspectAwe(file);
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AWE-MANIFEST-001'));
    fs.rmSync(path.dirname(file), {recursive: true, force: true});
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('rejects a manifest violating the JSON schema', () => {
    const bad = Object.assign({}, validManifest, {id: 'Invalid ID!'});
    const file = writeTemp(buildAwe(bad));
    const result = inspectAwe(file);
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AWE-MANIFEST-009'));
    fs.rmSync(path.dirname(file), {recursive: true, force: true});
});

test('rejects contributes.blocks without the editor.blocks permission', () => {
    const bad = Object.assign({}, validManifest, {permissions: ['project.read']});
    const file = writeTemp(buildAwe(bad));
    const result = inspectAwe(file);
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AWE-MANIFEST-004'));
    fs.rmSync(path.dirname(file), {recursive: true, force: true});
});

test('flags a missing declared blocks file', () => {
    const file = writeTemp(buildAwe(validManifest));
    const result = inspectAwe(file);
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AWE-MANIFEST-006' && /blocks\.json/.test(d.message)));
    fs.rmSync(path.dirname(file), {recursive: true, force: true});
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('warns on trusted runtime code and reports the entry without executing it', () => {
    const manifest = Object.assign({}, validManifest, {
        permissions: ['project.read'],
        contributes: undefined,
        runtime: {entry: 'runtime/main.js', trusted: true}
    });
    const file = writeTemp(buildAwe(manifest, [['runtime/main.js', 'console.log("never run")']]));
    const result = inspectAwe(file);
    assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
    assert.equal(result.runtimeEntry, 'runtime/main.js');
    assert.ok(result.diagnostics.some(d => d.code === 'AWE-MANIFEST-008' && d.severity === 'warning'));
    fs.rmSync(path.dirname(file), {recursive: true, force: true});
});

test('rejects an unsafe archive path', () => {
    const manifest = Object.assign({}, validManifest, {permissions: [], contributes: undefined});
    const evil = zlib.deflateRawSync(Buffer.from('{}'));
    const file = writeTemp(buildAwe(manifest, [['../evil.json', evil]]));
    const result = inspectAwe(file);
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AWE-ARCHIVE-007'));
    fs.rmSync(path.dirname(file), {recursive: true, force: true});
});

test('rejects an unknown permission via schema enum', () => {
    const bad = Object.assign({}, validManifest, {permissions: ['shell.root']});
    const file = writeTemp(buildAwe(bad));
    const result = inspectAwe(file);
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.some(d => d.code === 'AWE-MANIFEST-009'));
    fs.rmSync(path.dirname(file), {recursive: true, force: true});
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('reports info diagnostics for approval-required permissions', () => {
    const manifest = Object.assign({}, validManifest, {permissions: ['host.mdl'], contributes: undefined});
    const file = writeTemp(buildAwe(manifest));
    const result = inspectAwe(file);
    assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
    assert.ok(result.diagnostics.some(d => d.code === 'AWE-MANIFEST-007' && d.severity === 'info'));
    fs.rmSync(path.dirname(file), {recursive: true, force: true});
});

test('parses multiple panel documents', () => {
    const manifest = Object.assign({}, validManifest, {
        permissions: ['editor.panels', 'editor.blocks'],
        contributes: {blocks: 'blocks.json', panels: ['panels/source.json']}
    });
    const file = writeTemp(buildAwe(manifest, [
        ['blocks.json', '{"blocks":[]}'],
        ['panels/source.json', '{"title":"Source"}']
    ]));
    const result = inspectAwe(file);
    assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
    assert.equal(result.panels.length, 1);
    assert.equal(result.panels[0].doc.title, 'Source');
    fs.rmSync(path.dirname(file), {recursive: true, force: true});
});
