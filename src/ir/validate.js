'use strict';

const BASIC_ACTIONS = new Set(['log.info']);
const PREVIEW_ONLY_ACTIONS = new Set([
    'schedule.once',
    'schedule.repeat',
    'wait',
    'set-variable',
    'compare'
]);
const EVENTS = new Set([
    'lifecycle.preinit',
    'lifecycle.init',
    'lifecycle.setup',
    'lifecycle.complete',
    'game.tick',
    'world.load',
    'world.unload'
]);
const WORK_TYPES = new Set(['AprismJEMod', 'AprismExtension']);
const RESOURCE_KEY = /^[a-z][a-z0-9_-]{1,63}:[a-z][a-z0-9_-]{1,63}$/;

/**
 * Validates the AprismWarp IR subset that can be safely previewed or exported.
 * The validator deliberately owns cross-node rules that JSON Schema cannot
 * express, including registration timing and stable node identities.
 *
 * @param {unknown} ir candidate IR document
 * @param {{mode?: 'preview' | 'export'}} [options] validation target
 * @returns {{valid: boolean, diagnostics: Array<{code: string, severity: string, message: string, nodeId: string | null}>}}
 */
function validateIr(ir, options = {}) {
    const mode = options.mode || 'export';
    const diagnostics = [];
    const seenNodeIds = new Set();

    const report = (code, message, nodeId = null) => {
        diagnostics.push({code, severity: 'error', message, nodeId});
    };

    if (mode !== 'preview' && mode !== 'export') {
        report('AWP-IR-000', `Unknown validation mode: ${mode}`);
        return {valid: false, diagnostics};
    }
    if (!isRecord(ir)) {
        report('AWP-IR-001', 'IR must be an object.');
        return {valid: false, diagnostics};
    }
    if (ir.irVersion !== 1) {
        report('AWP-IR-002', 'IR version must be 1.');
    }
    if (!isProjectId(ir.projectId)) {
        report('AWP-IR-003', 'Project ID must be a lowercase Aprism identifier.');
    }
    if (!WORK_TYPES.has(ir.workType)) {
        report('AWP-IR-004', 'Work type must be AprismJEMod or AprismExtension.');
    }
    if (!isRecord(ir.target) || ir.target.edition !== 'JE' || !isNonBlankString(ir.target.minecraft) || !isNonBlankString(ir.target.aprism)) {
        report('AWP-IR-005', 'Target must declare JE, Minecraft, and Aprism versions.');
    }
    if (!Array.isArray(ir.capabilities) || !ir.capabilities.includes('basic')) {
        report('AWP-IR-006', 'IR must declare the basic capability.');
    }
    if (!Array.isArray(ir.declarations) || !Array.isArray(ir.handlers)) {
        report('AWP-IR-007', 'IR must provide declarations and handlers arrays.');
        return {valid: false, diagnostics};
    }

    if (ir.workType === 'AprismExtension') {
        validateExtension(ir, report);
    }

    const initHandlers = ir.handlers.filter(handler => isRecord(handler) && handler.event === 'lifecycle.init');
    let requiresInit = false;
    for (const declaration of ir.declarations) {
        validateDeclaration(declaration, report, seenNodeIds);
        requiresInit ||= ir.workType === 'AprismJEMod'
            && isRecord(declaration) && ['item', 'block'].includes(declaration.declaration);
    }
    for (const handler of ir.handlers) {
        validateHandler(handler, report, seenNodeIds, mode);
    }
    if (requiresInit && initHandlers.length === 0) {
        report('AWP-IR-008', 'Item and block declarations require a lifecycle.init handler.');
    }

    return {valid: diagnostics.length === 0, diagnostics};
}

function validateExtension(ir, report) {
    if (!isRecord(ir.extension)) {
        report('AWP-IR-050', 'AprismExtension IR must declare extension metadata.');
        return;
    }
    if (!isNonBlankString(ir.extension.type)) {
        report('AWP-IR-051', 'AprismExtension must declare an extension type.');
    }
    if (!isNonBlankString(ir.extension.aprismRange)) {
        report('AWP-IR-052', 'AprismExtension must declare an Aprism compatibility range.');
    }
    if (ir.extension.loaderKey !== undefined && !isNonBlankString(ir.extension.loaderKey)) {
        report('AWP-IR-053', 'Extension loaderKey must be a non-empty string when present.');
    }
    if (ir.declarations.some(declaration => isRecord(declaration)
        && ['item', 'block', 'entity'].includes(declaration.declaration))) {
        report('AWP-IR-054', 'AprismExtension cannot declare JE content items, blocks, or entities.');
    }
}

function validateDeclaration(node, report, seenNodeIds) {
    const nodeId = nodeIdOf(node);
    validateNodeIdentity(node, report, seenNodeIds);
    if (!isRecord(node) || node.kind !== 'declaration') {
        report('AWP-IR-010', 'Declaration must have kind declaration.', nodeId);
        return;
    }
    if (!['mod', 'dependency', 'item', 'block', 'resource'].includes(node.declaration)) {
        report('AWP-IR-011', 'Unknown declaration type.', nodeId);
        return;
    }
    if (!isNonBlankString(node.id)) {
        report('AWP-IR-012', 'Declaration ID is required.', nodeId);
        return;
    }
    if (node.declaration === 'item') {
        validateResourceKey(node.id, report, nodeId);
        if (!Number.isInteger(node.maxStack) || node.maxStack < 1 || node.maxStack > 64) {
            report('AWP-IR-013', 'Item stack size must be between 1 and 64.', nodeId);
        }
    }
    if (node.declaration === 'block') {
        validateResourceKey(node.id, report, nodeId);
        if (!Number.isFinite(node.hardness) || !Number.isFinite(node.resistance)) {
            report('AWP-IR-014', 'Block hardness and resistance must be numbers.', nodeId);
        }
        if (!Number.isInteger(node.luminance) || node.luminance < 0 || node.luminance > 15) {
            report('AWP-IR-015', 'Block luminance must be between 0 and 15.', nodeId);
        }
    }
    if (node.declaration === 'resource' && (!isSafeRelativePath(node.path))) {
        report('AWP-IR-016', 'Resource path must be a safe relative path.', nodeId);
    }
}

function validateHandler(node, report, seenNodeIds, mode) {
    const nodeId = nodeIdOf(node);
    validateNodeIdentity(node, report, seenNodeIds);
    if (!isRecord(node) || node.kind !== 'event') {
        report('AWP-IR-020', 'Handler must have kind event.', nodeId);
        return;
    }
    if (!EVENTS.has(node.event)) {
        report('AWP-IR-021', 'Unknown or unsupported event.', nodeId);
    }
    if (node.event === 'game.tick' && !['START', 'END'].includes(node.stage)) {
        report('AWP-IR-022', 'Game tick handlers require START or END stage.', nodeId);
    }
    if (node.event !== 'game.tick' && node.stage !== undefined) {
        report('AWP-IR-023', 'Only game.tick handlers may declare a stage.', nodeId);
    }
    if (!Array.isArray(node.body)) {
        report('AWP-IR-024', 'Event handler body must be an array.', nodeId);
        return;
    }
    for (const action of node.body) {
        validateAction(action, report, seenNodeIds, mode);
    }
}

function validateAction(node, report, seenNodeIds, mode) {
    const nodeId = nodeIdOf(node);
    validateNodeIdentity(node, report, seenNodeIds);
    if (!isRecord(node) || node.kind !== 'action') {
        report('AWP-IR-030', 'Action must have kind action.', nodeId);
        return;
    }
    if (BASIC_ACTIONS.has(node.action)) {
        if (!isNonBlankString(node.message) || node.message.length > 4096) {
            report('AWP-IR-031', 'log.info requires a non-empty message up to 4096 characters.', nodeId);
        }
        return;
    }
    if (!PREVIEW_ONLY_ACTIONS.has(node.action)) {
        report('AWP-IR-032', 'Unknown or unsupported action.', nodeId);
        return;
    }
    if (node.action === 'schedule.once' || node.action === 'wait') {
        validatePositiveTicks(node.delayTicks, report, nodeId);
    }
    if (node.action === 'schedule.repeat') {
        validatePositiveTicks(node.intervalTicks, report, nodeId);
    }
    if (node.previewOnly !== true) {
        report('AWP-IR-033', 'Preview-only actions must set previewOnly to true.', nodeId);
    }
    if (mode === 'export') {
        report('AWP-IR-034', 'Preview-only action cannot be exported in IR v0.1.', nodeId);
    }
}

function validateNodeIdentity(node, report, seenNodeIds) {
    const nodeId = nodeIdOf(node);
    if (!isNodeId(nodeId)) {
        report('AWP-IR-040', 'Node ID must contain only letters, numbers, underscores, or hyphens.', nodeId);
        return;
    }
    if (seenNodeIds.has(nodeId)) {
        report('AWP-IR-041', 'Node ID must be unique within the project.', nodeId);
        return;
    }
    seenNodeIds.add(nodeId);
}

function validateResourceKey(value, report, nodeId) {
    if (!RESOURCE_KEY.test(value)) {
        report('AWP-IR-042', 'Resource key must use lowercase namespace:name form.', nodeId);
    }
}

function validatePositiveTicks(value, report, nodeId) {
    if (!Number.isInteger(value) || value < 1) {
        report('AWP-IR-043', 'Tick delay must be a positive integer.', nodeId);
    }
}

function isSafeRelativePath(value) {
    return isNonBlankString(value) && !value.includes('\\') && !value.startsWith('/') && !value.split('/').includes('..');
}

function isProjectId(value) {
    return typeof value === 'string' && /^[a-z][a-z0-9_-]{1,63}$/.test(value);
}

function isNodeId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function isNonBlankString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nodeIdOf(value) {
    return isRecord(value) && typeof value.nodeId === 'string' ? value.nodeId : null;
}

module.exports = {validateIr};
