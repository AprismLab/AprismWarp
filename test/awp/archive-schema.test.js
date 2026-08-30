'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {readAwp, writeAwp, configureSchemaPaths, inspectArchive} = require('../../src/awp/archive');

const schemaDir = path.join(__dirname, '..', '..', 'schemas');

function makeTempDir(label) {
    return fs.mkdtempSync(path.join(os.tmpdir(), `aprismwarp-${label}-`));
}

function buildAwpFixture(workspaceDir) {
    const manifest = {
        format: 'aprismwarp-project',
        schemaVersion: 1,
        projectId: 'schema-mod',
        name: 'Schema Mod',
        workType: 'AprismJEMod',
        workProfile: {minecraftVersion: '26.2', aprismVersion: 'v26.8-Alpha.7', workType: 'AprismJEMod'},
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        source: {editor: 'aprismwarp-native', project: 'editor/project.json', ir: 'ir/project.json'}
    };
    const ir = {
        irVersion: 1, projectId: 'schema-mod', workType: 'AprismJEMod',
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        capabilities: ['basic'],
        declarations: [],
        handlers: []
    };
    const awpPath = path.join(workspaceDir, 'project.awp');
    writeAwp(awpPath, {manifest, ir});
    return awpPath;
}
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('readAwp accepts a well-formed AWP when schemas are configured', () => {
    const dir = makeTempDir('schema-ok');
    try {
        configureSchemaPaths({
            awpManifestSchemaPath: path.join(schemaDir, 'awp.schema.json'),
            irSchemaPath: path.join(schemaDir, 'ir.schema.json')
        });
        const awpPath = buildAwpFixture(dir);
        const project = readAwp(awpPath);
        assert.equal(project.manifest.projectId, 'schema-mod');
        assert.equal(project.ir.workType, 'AprismJEMod');
    } finally {


        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('readAwp rejects an AWP whose manifest violates the schema', () => {
    const dir = makeTempDir('schema-bad');
    try {
        configureSchemaPaths({
            awpManifestSchemaPath: path.join(schemaDir, 'awp.schema.json'),
            irSchemaPath: path.join(schemaDir, 'ir.schema.json')
        });
        const awpPath = path.join(dir, 'bad.awp');
        const manifest = {
            format: 'aprismwarp-project',
            schemaVersion: 1,
            projectId: 'bad-mod',
            name: 'Bad Mod',
            workType: 'AprismJEMod',
            workProfile: {minecraftVersion: '26.2', aprismVersion: 'v26.8-Alpha.7', workType: 'AprismJEMod'},
            target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
            source: {editor: 'aprismwarp-native', project: 'editor/project.json', ir: 'ir/project.json'},
            extensions: {aepCapabilities: [{id: 'oops', version: '1.0.0', sha256: 'not-hex'}]}
        };
        const ir = {
            irVersion: 1, projectId: 'bad-mod', workType: 'AprismJEMod',
            target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
            capabilities: ['basic'], declarations: [], handlers: []
        };
        writeAwp(awpPath, {manifest, ir}, {skipValidation: true});
        assert.throws(() => readAwp(awpPath), /AWP-SCHEMA-001/);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('readAwp rejects an AWP whose IR violates the schema', () => {
    const dir = makeTempDir('schema-ir-bad');
    try {
        configureSchemaPaths({
            awpManifestSchemaPath: path.join(schemaDir, 'awp.schema.json'),
            irSchemaPath: path.join(schemaDir, 'ir.schema.json')
        });
        const awpPath = path.join(dir, 'ir-bad.awp');
        const manifest = {
            format: 'aprismwarp-project',
            schemaVersion: 1,
            projectId: 'ir-bad',
            name: 'IR Bad',
            workType: 'AprismJEMod',
            workProfile: {minecraftVersion: '26.2', aprismVersion: 'v26.8-Alpha.7', workType: 'AprismJEMod'},


            target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
            source: {editor: 'aprismwarp-native', project: 'editor/project.json', ir: 'ir/project.json'}
        };
        const ir = {
            irVersion: 1, projectId: 'ir-bad', workType: 'AprismJEMod',
            target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7', intruder: 'who am I'},
            capabilities: ['basic'],
            declarations: [],
            handlers: []
        };
        writeAwp(awpPath, {manifest, ir}, {skipValidation: true});
        assert.throws(() => readAwp(awpPath), /AWP-SCHEMA-002/);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('readAwp skips schema validation when no paths are configured', () => {
    const dir = makeTempDir('schema-skip');
    try {
        configureSchemaPaths({awpManifestSchemaPath: null, irSchemaPath: null});
        const awpPath = buildAwpFixture(dir);
        const project = readAwp(awpPath);
        assert.equal(project.manifest.projectId, 'schema-mod');
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

