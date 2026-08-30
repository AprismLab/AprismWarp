'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {validateIr} = require('../../src/ir/validate');

const example = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '..', 'examples', 'minimal.ir.json'),
    'utf8'
));

test('accepts the minimal exportable IR example', () => {
    const result = validateIr(example);

    assert.equal(result.valid, true);
    assert.deepEqual(result.diagnostics, []);
});

test('requires an INIT handler for item and block declarations', () => {
    const ir = structuredClone(example);
    ir.handlers = ir.handlers.filter(handler => handler.event !== 'lifecycle.init');

    assertDiagnostic(validateIr(ir), 'AWP-IR-008');
});

test('rejects duplicate node IDs', () => {
    const ir = structuredClone(example);
    ir.handlers[1].nodeId = 'item-widget';

    assertDiagnostic(validateIr(ir), 'AWP-IR-041');
});

test('rejects invalid item resource keys and stack sizes', () => {
    const ir = structuredClone(example);
    ir.declarations[0].id = 'ExampleMod:Widget';
    ir.declarations[0].maxStack = 65;

    const result = validateIr(ir);
    assertDiagnostic(result, 'AWP-IR-013');
    assertDiagnostic(result, 'AWP-IR-042');
});

test('allows preview-only actions only during preview validation', () => {
    const ir = structuredClone(example);
    ir.handlers[1].body.push({
        nodeId: 'preview-wait',
        kind: 'action',
        action: 'wait',

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

        delayTicks: 20,
        previewOnly: true
    });

    assert.equal(validateIr(ir, {mode: 'preview'}).valid, true);
    assertDiagnostic(validateIr(ir, {mode: 'export'}), 'AWP-IR-034');
});

test('requires preview-only marking for preview actions', () => {
    const ir = structuredClone(example);
    ir.handlers[1].body.push({
        nodeId: 'unmarked-wait',
        kind: 'action',
        action: 'wait',
        delayTicks: 20
    });

    assertDiagnostic(validateIr(ir, {mode: 'preview'}), 'AWP-IR-033');
});

test('requires extension metadata for AprismExtension projects', () => {
    const ir = structuredClone(example);
    ir.workType = 'AprismExtension';

    assertDiagnostic(validateIr(ir), 'AWP-IR-050');
});

test('rejects JE content declarations in AprismExtension projects', () => {
    const ir = structuredClone(example);
    ir.workType = 'AprismExtension';
    ir.extension = {
        type: 'api-extension',
        aprismRange: '>=26.0.0'
    };

    assertDiagnostic(validateIr(ir), 'AWP-IR-054');
});

test('accepts a minimal AprismExtension project without JE content', () => {
    const ir = structuredClone(example);
    ir.workType = 'AprismExtension';
    ir.declarations = [];
    ir.extension = {
        type: 'api-extension',
        aprismRange: '>=26.0.0',
        provides: ['aprismwarp:preview']
    };

    assert.equal(validateIr(ir).valid, true);
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


test('rejects an unknown work type', () => {
    const ir = structuredClone(example);
    ir.workType = 'UnknownProject';

    assertDiagnostic(validateIr(ir), 'AWP-IR-004');
});

test('rejects extension metadata in AprismJEMod projects', () => {
    const ir = structuredClone(example);
    ir.extension = {
        type: 'api-extension',
        aprismRange: '>=26.0.0'
    };

    assertDiagnostic(validateIr(ir), 'AWP-IR-055');
});

function assertDiagnostic(result, code) {
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.some(diagnostic => diagnostic.code === code),
        `Expected diagnostic ${code}, got ${JSON.stringify(result.diagnostics)}`);
}
