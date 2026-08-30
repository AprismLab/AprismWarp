'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const assert = require('node:assert/strict');
const test = require('node:test');
const {createProject, WORK_TYPE_PALETTES} = require('../../src/wizard/project');
const {validateIr} = require('../../src/ir/validate');
const {writeAwp, readAwp} = require('../../src/awp/archive');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const modSpec = {
    projectId: 'wizard-mod',
    name: 'Wizard Mod',
    workType: 'AprismJEMod',
    description: 'Created by the wizard.',
    author: 'BlockConnect@StarsailsClover'
};

const extensionSpec = {
    projectId: 'wizard-ext',
    name: 'Wizard Extension',
    workType: 'AprismExtension'
};

test('createProject builds a valid AprismJEMod project with init scaffold', () => {
    const project = createProject(modSpec);
    assert.equal(project.manifest.workType, 'AprismJEMod');
    assert.equal(project.manifest.editor.entrypoint, 'com.aprismwarp.generated.Wizard_modMod');
    assert.equal(project.ir.handlers.length, 1);
    assert.equal(project.ir.handlers[0].event, 'lifecycle.init');
    assert.equal(project.ir.handlers[0].body[0].action, 'log.info');
    const preview = validateIr(project.ir, {mode: 'preview'});
    assert.equal(preview.valid, true, JSON.stringify(preview.diagnostics));
    assert.equal(project.palette, WORK_TYPE_PALETTES.AprismJEMod);
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('createProject builds a valid AprismExtension project with extension metadata', () => {
    const project = createProject(extensionSpec);
    assert.equal(project.ir.extension.type, 'api');
    assert.equal(project.ir.extension.aprismRange, '>=26.8.0 <26.9.0');
    assert.equal(project.editor, null);
    const preview = validateIr(project.ir, {mode: 'preview'});
    assert.equal(preview.valid, true, JSON.stringify(preview.diagnostics));
    assert.equal(project.palette, WORK_TYPE_PALETTES.AprismExtension);
});

test('createProject output round-trips through writeAwp and readAwp', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wizard-awp-'));
    const awpPath = path.join(dir, 'wizard-mod.awp');
    const project = createProject(modSpec);
    writeAwp(awpPath, {manifest: project.manifest, ir: project.ir});
    const loaded = readAwp(awpPath);
    assert.equal(loaded.manifest.projectId, 'wizard-mod');
    assert.equal(loaded.manifest.editor.entrypoint, 'com.aprismwarp.generated.Wizard_modMod');
    assert.deepEqual(loaded.ir.handlers, project.ir.handlers);
    fs.rmSync(dir, {recursive: true, force: true});
});

test('createProject rejects invalid specs with WIZ diagnostics', () => {
    assert.throws(() => createProject(null), /WIZ-001/);
    assert.throws(() => createProject(Object.assign({}, modSpec, {projectId: 'Bad Id'})), /WIZ-002/);
    assert.throws(() => createProject(Object.assign({}, modSpec, {name: '  '})), /WIZ-003/);
    assert.throws(() => createProject(Object.assign({}, modSpec, {workType: 'Other'})), /WIZ-004/);
});

test('createProject rejects unverified target profiles with WIZ-005', () => {
    assert.throws(() => createProject(Object.assign({}, modSpec, {minecraftVersion: '26.0'})), /WIZ-005/);
    assert.throws(() => createProject(Object.assign({}, modSpec, {aprismVersion: 'v27.0.0'})), /WIZ-005/);
});

test('palettes expose the IR v0.1 surface per work type', () => {
    const modPalette = WORK_TYPE_PALETTES.AprismJEMod;
    assert.equal(modPalette.events.length, 7);
    assert.equal(modPalette.declarations.length, 5);
    assert.equal(modPalette.actions.filter(a => !a.previewOnly).length, 1);
    assert.equal(modPalette.actions.filter(a => a.previewOnly).length, 5);
    const extPalette = WORK_TYPE_PALETTES.AprismExtension;
    assert.equal(extPalette.events.length, 4);
    assert.deepEqual(extPalette.declarations, []);
    assert.deepEqual(extPalette.actions.map(a => a.id), ['log.info']);
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover
