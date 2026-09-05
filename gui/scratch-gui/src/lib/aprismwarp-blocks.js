/*
 * AprismWarp block catalog for the scratch-gui fork.
 * GitHub@NDBlockConnect | BlockConnect@StarsailsClover
 *
 * Every block maps to exactly one IR v0.1 node family (D-03). The
 * palette mirrors src/wizard/project.js WORK_TYPE_PALETTES in the core
 * toolchain. IR extraction walks the workspace and emits a document
 * that passes validateIr in preview mode.
 */

const CATEGORY_COLOR = '#5C81C6';
const EVENT_COLOR = '#FFBF00';
const ACTION_COLOR = '#4C97FF';

const WORK_TYPES = ['AprismJEMod', 'AprismExtension'];

const LIFECYCLE_EVENTS = ['lifecycle.preinit', 'lifecycle.init', 'lifecycle.setup', 'lifecycle.complete'];
const GAME_EVENTS = ['game.tick', 'world.load', 'world.unload'];

const blockDefinitions = [
    ...LIFECYCLE_EVENTS.map(event => ({
        type: `aprismwarp_${event.replace('.', '_')}`,
        message0: `when ${event}`,
        args0: [],
        category: 'AprismWarp',
        colour: EVENT_COLOR,
        extensions: ['shape_hat'],
        nextStatement: null
    })),
    {
        type: 'aprismwarp_game_tick',
        message0: 'every game tick %1',
        args0: [{
            type: 'field_dropdown',
            name: 'STAGE',
            options: [['start', 'START'], ['end', 'END']]
        }],
        category: 'AprismWarp',
        colour: EVENT_COLOR,
        extensions: ['shape_hat'],
        nextStatement: null
    },
    ...GAME_EVENTS.filter(event => event !== 'game.tick').map(event => ({
        type: `aprismwarp_${event.replace('.', '_')}`,
        message0: `when ${event}`,
        args0: [],
        category: 'AprismWarp',
        colour: EVENT_COLOR,
        extensions: ['shape_hat'],
        nextStatement: null
    })),
    {
        type: 'aprismwarp_log_info',
        message0: 'log info %1',
        args0: [{type: 'field_input', name: 'MESSAGE', text: 'message'}],
        category: 'AprismWarp',
        colour: ACTION_COLOR,
        previousStatement: null,
        nextStatement: null
    },
    {
        type: 'aprismwarp_schedule_once',
        message0: 'schedule once in %1 ticks',
        args0: [{type: 'field_number', name: 'DELAYTICKS', value: 20, min: 1, precision: 1}],
        category: 'AprismWarp',
        colour: ACTION_COLOR,
        previousStatement: null,
        nextStatement: null
    },
    {
        type: 'aprismwarp_schedule_repeat',
        message0: 'schedule repeat every %1 ticks',
        args0: [{type: 'field_number', name: 'INTERVALTICKS', value: 20, min: 1, precision: 1}],
        category: 'AprismWarp',
        colour: ACTION_COLOR,
        previousStatement: null,
        nextStatement: null
    },
    {
        type: 'aprismwarp_wait',
        message0: 'wait %1 ticks',
        args0: [{type: 'field_number', name: 'DELAYTICKS', value: 10, min: 1, precision: 1}],
        category: 'AprismWarp',
        colour: ACTION_COLOR,
        previousStatement: null,
        nextStatement: null
    },
    {
        type: 'aprismwarp_set_variable',
        message0: 'set variable %1 to %2',
        args0: [
            {type: 'field_input', name: 'NAME', text: 'score'},
            {type: 'field_number', name: 'VALUE', value: 0}
        ],
        category: 'AprismWarp',
        colour: ACTION_COLOR,
        previousStatement: null,
        nextStatement: null
    },
    {
        type: 'aprismwarp_compare',
        message0: 'compare %1 %2 %3',
        args0: [
            {type: 'field_input', name: 'LEFT', text: 'score'},
            {type: 'field_dropdown', name: 'OPERATOR', options: [['equals', 'eq'], ['not equals', 'ne'], ['greater than', 'gt'], ['less than', 'lt']]},
            {type: 'field_number', name: 'RIGHT', value: 0}
        ],
        category: 'AprismWarp',
        colour: ACTION_COLOR,
        previousStatement: null,
        nextStatement: null
    },
    {
        type: 'aprismwarp_declaration_item',
        message0: 'declare item %1 stack %2',
        args0: [
            {type: 'field_input', name: 'RESOURCEKEY', text: 'aprismwarp:item'},
            {type: 'field_number', name: 'STACKSIZE', value: 64, min: 1, max: 64, precision: 1}
        ],
        category: 'AprismWarp',
        colour: CATEGORY_COLOR,
        previousStatement: null,
        nextStatement: null
    },
    {
        type: 'aprismwarp_declaration_block',
        message0: 'declare block %1',
        args0: [{type: 'field_input', name: 'RESOURCEKEY', text: 'aprismwarp:block'}],
        category: 'AprismWarp',
        colour: CATEGORY_COLOR,
        previousStatement: null,
        nextStatement: null
    }
];

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

/**
 * Registers the AprismWarp blocks on a loaded scratch-blocks namespace.
 * Called once after LazyScratchBlocks resolves.
 */
function registerAprismWarpBlocks (ScratchBlocks) {
    if (!ScratchBlocks || typeof ScratchBlocks.defineBlocksWithJsonArray !== 'function') {
        throw new Error('aprismwarp-blocks: scratch-blocks namespace unavailable');
    }
    ScratchBlocks.defineBlocksWithJsonArray(blockDefinitions);
}

function eventBlockType (event) {
    return `aprismwarp_${event.replace('.', '_')}`;
}

function eventOfBlockType (type) {
    if (type === 'aprismwarp_game_tick') return 'game.tick';
    if (!type.startsWith('aprismwarp_')) return null;
    const suffix = type.slice('aprismwarp_'.length);
    const event = suffix.replace('_', '.');
    return LIFECYCLE_EVENTS.includes(event) || GAME_EVENTS.includes(event) ? event : null;
}

function actionOfBlock (block) {
    if (block.type === 'aprismwarp_log_info') {
        return {
            nodeId: block.id,
            kind: 'action',
            action: 'log.info',
            message: String(block.getFieldValue('MESSAGE') || '')
        };
    }
    if (block.type === 'aprismwarp_schedule_once') {
        return {
            nodeId: block.id,
            kind: 'action',
            action: 'schedule.once',
            delayTicks: Number(block.getFieldValue('DELAYTICKS')),
            previewOnly: true
        };
    }
    if (block.type === 'aprismwarp_schedule_repeat') {
        return {
            nodeId: block.id,
            kind: 'action',
            action: 'schedule.repeat',
            intervalTicks: Number(block.getFieldValue('INTERVALTICKS')),
            previewOnly: true
        };
    }
    if (block.type === 'aprismwarp_wait') {
        return {
            nodeId: block.id,
            kind: 'action',
            action: 'wait',
            delayTicks: Number(block.getFieldValue('DELAYTICKS')),
            previewOnly: true
        };
    }
    if (block.type === 'aprismwarp_set_variable') {
        return {
            nodeId: block.id,
            kind: 'action',
            action: 'set-variable',
            name: String(block.getFieldValue('NAME') || ''),
            value: Number(block.getFieldValue('VALUE')),
            previewOnly: true
        };
    }
    if (block.type === 'aprismwarp_compare') {
        return {
            nodeId: block.id,
            kind: 'action',
            action: 'compare',
            left: String(block.getFieldValue('LEFT') || ''),
            operator: String(block.getFieldValue('OPERATOR') || 'eq'),
            right: Number(block.getFieldValue('RIGHT')),
            previewOnly: true
        };
    }
    return null;
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

function declarationOfBlock (block) {
    if (block.type === 'aprismwarp_declaration_item') {
        const resourceKey = String(block.getFieldValue('RESOURCEKEY') || '');
        return {
            nodeId: block.id,
            id: resourceKey,
            kind: 'declaration',
            declaration: 'item',
            resourceKey,
            maxStack: Number(block.getFieldValue('STACKSIZE'))
        };
    }
    if (block.type === 'aprismwarp_declaration_block') {
        const resourceKey = String(block.getFieldValue('RESOURCEKEY') || '');
        return {
            nodeId: block.id,
            id: resourceKey,
            kind: 'declaration',
            declaration: 'block',
            resourceKey
        };
    }
    return null;
}

function walkStatementChain (startBlock, collected) {
    let block = startBlock;
    while (block) {
        const action = actionOfBlock(block);
        if (action) collected.push(action);
        block = block.getNextBlock();
    }
}

/**
 * Extracts an IR v0.1 document from the workspace. Event hats become
 * handlers; declaration and action blocks inside their bodies become
 * IR nodes. Returns null when the work type is unknown.
 */
function extractAprismWarpIr (workspace, workType, projectId, target) {
    if (!WORK_TYPES.includes(workType)) return null;
    const handlers = [];
    const declarations = [];
    for (const topBlock of workspace.getTopBlocks(false)) {
        const event = eventOfBlockType(topBlock.type);
        if (event) {
            const body = [];
            walkStatementChain(topBlock.getNextBlock(), body);
            const handler = {nodeId: topBlock.id, kind: 'event', event, body};
            if (event === 'game.tick') handler.stage = String(topBlock.getFieldValue('STAGE') || 'START');
            handlers.push(handler);
            continue;
        }
        const declaration = declarationOfBlock(topBlock);
        if (declaration) declarations.push(declaration);
    }
    return {
        irVersion: 1,
        projectId,
        workType,
        target,
        capabilities: ['basic'],
        declarations,
        handlers
    };
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

/**
 * Builds the AprismWarp toolbox category XML for the current work type.
 * Extension projects see lifecycle events and actions only.
 */
function aprismWarpToolboxXML (workType) {
    if (!WORK_TYPES.includes(workType)) return '';
    const eventBlocks = (workType === 'AprismExtension' ? LIFECYCLE_EVENTS : [...LIFECYCLE_EVENTS, ...GAME_EVENTS])
        .map(event => {
            if (event === 'game.tick') {
                return `<block type="aprismwarp_game_tick"><field name="STAGE">START</field></block>`;
            }
            return `<block type="${eventBlockType(event)}"></block>`;
        }).join('');
    const actionBlocks = `<block type="aprismwarp_log_info">
            <field name="MESSAGE">message</field>
        </block>
        <block type="aprismwarp_schedule_once"><field name="DELAYTICKS">20</field></block>
        <block type="aprismwarp_schedule_repeat"><field name="INTERVALTICKS">20</field></block>
        <block type="aprismwarp_wait"><field name="DELAYTICKS">10</field></block>
        <block type="aprismwarp_set_variable">
            <field name="NAME">score</field>
            <field name="VALUE">0</field>
        </block>
        <block type="aprismwarp_compare">
            <field name="LEFT">score</field>
            <field name="OPERATOR">eq</field>
            <field name="RIGHT">0</field>
        </block>`;
    const declarationBlocks = workType === 'AprismExtension' ? '' : `
        <block type="aprismwarp_declaration_item">
            <field name="RESOURCEKEY">aprismwarp:item</field>
            <field name="STACKSIZE">64</field>
        </block>
        <block type="aprismwarp_declaration_block">
            <field name="RESOURCEKEY">aprismwarp:block</field>
        </block>`;
    return `<category name="AprismWarp" id="aprismwarp" colour="${CATEGORY_COLOR}" secondaryColour="#3373CC">
        ${eventBlocks}
        ${declarationBlocks}
        ${actionBlocks}
    </category>`;
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const FIELD_OF_ACTION = {
    'log.info': [{name: 'MESSAGE', from: 'message'}],
    'schedule.once': [{name: 'DELAYTICKS', from: 'delayTicks'}],
    'schedule.repeat': [{name: 'INTERVALTICKS', from: 'intervalTicks'}],
    'wait': [{name: 'DELAYTICKS', from: 'delayTicks'}],
    'set-variable': [{name: 'NAME', from: 'name'}, {name: 'VALUE', from: 'value'}],
    'compare': [{name: 'LEFT', from: 'left'}, {name: 'OPERATOR', from: 'operator'}, {name: 'RIGHT', from: 'right'}]
};

function actionToXml (action, indent) {
    const blockType = `aprismwarp_${action.action.replace('.', '_')}`;
    const fields = (FIELD_OF_ACTION[action.action] || [])
        .map(field => `${indent}  <field name="${field.name}">${action[field.from]}</field>`)
        .join('');
    return `${indent}<block type="${blockType}" id="${action.nodeId}">${fields}</block>`;
}

function declarationToXml (declaration, indent) {
    const blockType = `aprismwarp_declaration_${declaration.declaration}`;
    const fields = [];
    if (declaration.resourceKey !== undefined) {
        fields.push(`${indent}  <field name="RESOURCEKEY">${declaration.resourceKey}</field>`);
    }
    if (declaration.maxStack !== undefined) {
        fields.push(`${indent}  <field name="STACKSIZE">${declaration.maxStack}</field>`);
    }
    return `${indent}<block type="${blockType}" id="${declaration.nodeId}">${fields.join('')}</block>`;
}

function handlerToXml (handler, indent) {
    const blockType = handler.event === 'game.tick'
        ? 'aprismwarp_game_tick'
        : eventBlockType(handler.event);
    const lines = [`${indent}<block type="${blockType}" id="${handler.nodeId}">`];
    if (handler.event === 'game.tick') {
        lines.push(`${indent}  <field name="STAGE">${handler.stage || 'START'}</field>`);
    }
    const body = handler.body || [];
    for (let i = 0; i < body.length; i += 1) {
        const actionXml = actionToXml(body[i], `${indent}  `);
        if (i === 0) {
            lines.push(`${indent}  <next>`, actionXml);
        } else {
            lines.push(`${indent}    <next>`, actionXml);
        }
        lines.push(`${indent}  </next>`);
    }
    lines.push(`${indent}</block>`);
    return lines.join('\n');
}

/**
 * Serializes an IR v0.1 document back into Blockly workspace XML so the
 * editor can reconstruct blocks saved in an .awp project.
 */
function irToWorkspaceXml (ir) {
    const parts = ['<xml xmlns="https://developers.google.com/blockly/xml">'];
    for (const declaration of ir.declarations || []) {
        parts.push(declarationToXml(declaration, '  '));
    }
    for (const handler of ir.handlers || []) {
        parts.push(handlerToXml(handler, '  '));
    }
    parts.push('</xml>');
    return parts.join('\n');
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const INTERPRETABLE_ACTIONS = new Set([
    'log.info', 'schedule.once', 'schedule.repeat', 'wait', 'set-variable', 'compare'
]);
const LIFECYCLE_ORDER = {
    'lifecycle.preinit': 0,
    'lifecycle.init': 1,
    'lifecycle.setup': 2,
    'lifecycle.complete': 3
};

function evaluateCompare (left, operator, right) {
    switch (operator) {
    case 'eq': return left === right;
    case 'ne': return left !== right;
    case 'gt': return left > right;
    case 'lt': return left < right;
    default: throw new Error(`aprismwarp-preview: unknown operator ${operator}`);
    }
}

/**
 * Preview interpreter for IR v0.1. Walks lifecycle handlers in phase
 * order and evaluates every action against a sandbox state, producing
 * a deterministic trace. Mirrors the IR validator grammar (AWP-IR-031/032):
 * unknown actions and malformed fields are refused the same way the
 * validator refuses them.
 *
 * @param {object} ir IR document
 * @returns {{trace: Array<object>, variables: object, errors: string[]}}
 */
function previewIr (ir) {
    const trace = [];
    const variables = {};
    const errors = [];
    const emit = (event, action, effect) => trace.push({event, nodeId: action.nodeId, action: action.action, effect});
    const handlers = [...(ir.handlers || [])].sort((a, b) => {
        const orderDiff = (LIFECYCLE_ORDER[a.event] ?? 99) - (LIFECYCLE_ORDER[b.event] ?? 99);
        return orderDiff !== 0 ? orderDiff : String(a.nodeId).localeCompare(String(b.nodeId));
    });
    for (const handler of handlers) {
        for (const action of handler.body || []) {
            try {
                if (action.kind !== 'action') throw new Error('node is not an action');
                if (!INTERPRETABLE_ACTIONS.has(action.action)) {
                    throw new Error(`unknown action ${action.action}`);
                }
                switch (action.action) {
                case 'log.info': {
                    if (typeof action.message !== 'string' || !action.message.length || action.message.length > 4096) {
                        throw new Error('log.info requires a message up to 4096 characters');
                    }
                    emit(handler.event, action, {type: 'log', message: action.message});
                    break;
                }
                case 'schedule.once': {
                    if (!Number.isInteger(action.delayTicks) || action.delayTicks < 1) {
                        throw new Error('schedule.once requires positive delayTicks');
                    }
                    emit(handler.event, action, {type: 'schedule', atTick: action.delayTicks, kind: 'once'});
                    break;
                }
                case 'schedule.repeat': {
                    if (!Number.isInteger(action.intervalTicks) || action.intervalTicks < 1) {
                        throw new Error('schedule.repeat requires positive intervalTicks');
                    }
                    emit(handler.event, action, {type: 'schedule', everyTicks: action.intervalTicks, kind: 'repeat'});
                    break;
                }
                case 'wait': {
                    if (!Number.isInteger(action.delayTicks) || action.delayTicks < 1) {
                        throw new Error('wait requires positive delayTicks');
                    }
                    emit(handler.event, action, {type: 'wait', ticks: action.delayTicks});
                    break;
                }
                case 'set-variable': {
                    if (typeof action.name !== 'string' || !action.name.trim()) {
                        throw new Error('set-variable requires a name');
                    }
                    variables[action.name] = action.value;
                    emit(handler.event, action, {type: 'variable', name: action.name, value: action.value});
                    break;
                }
                case 'compare': {
                    const left = Object.prototype.hasOwnProperty.call(variables, action.left)
                        ? variables[action.left]
                        : action.left;
                    const result = evaluateCompare(left, action.operator, action.right);
                    emit(handler.event, action, {type: 'compare', result});
                    break;
                }
                }
            } catch (error) {
                errors.push(`${handler.event}/${action.nodeId || 'unknown'}: ${error.message}`);
            }
        }
    }
    return {trace, variables, errors};
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

module.exports = {
    blockDefinitions,
    registerAprismWarpBlocks,
    extractAprismWarpIr,
    aprismWarpToolboxXML,
    irToWorkspaceXml,
    previewIr,
    WORK_TYPES
};

// Smoke/automation bridge (main world). Used by the Electron smoke gate.
if (typeof window !== 'undefined') {
    window.AprismWarpBlocks = {
        extractAprismWarpIr,
        aprismWarpToolboxXML,
        irToWorkspaceXml,
        previewIr,
        assembleSampleProject: async function () {
            const deadline = Date.now() + 30000;
            for (;;) {
                const ready = window.Blockly && window.Blockly.getMainWorkspace &&
                    window.Blockly.getMainWorkspace() &&
                    typeof window.Blockly.getMainWorkspace().getToolbox === 'function' &&
                    window.Blockly.getMainWorkspace().getToolbox();
                if (ready || Date.now() > deadline) break;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            const Blockly = window.Blockly;
            const workspace = Blockly.getMainWorkspace();
            if (!workspace) throw new Error('aprismwarp-blocks: workspace not ready');
            const sampleXml = '<xml xmlns="https://developers.google.com/blockly/xml">' +
                '<block type="aprismwarp_lifecycle_init" id="hat_init" x="10" y="10">' +
                '<next><block type="aprismwarp_log_info" id="act_log">' +
                '<field name="MESSAGE">hello from AprismWarp</field></block></next>' +
                '</block>' +
                '<block type="aprismwarp_declaration_item" id="decl_item" x="10" y="220">' +
                '<field name="RESOURCEKEY">aprismwarp:test_item</field>' +
                '<field name="STACKSIZE">16</field></block>' +
                '</xml>';
            Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(sampleXml), workspace);
            return JSON.stringify(extractAprismWarpIr(
                workspace,
                window.APRISMWARP_WORK_TYPE || 'AprismJEMod',
                'smoke-project',
                {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'}
            ));
        },

        //GitHub@NDBlockConnect | BlockConnect@StarsailsClover

        /**
         * Saves the current workspace as an .awp project through the host
         * bridge. project: {path, manifest}. The IR is extracted from the
         * live workspace; the manifest is merged with the saved result.
         */
        saveProject: async function (project) {
            const workspace = window.Blockly.getMainWorkspace();
            const ir = extractAprismWarpIr(
                workspace,
                window.APRISMWARP_WORK_TYPE || 'AprismJEMod',
                project.manifest.projectId,
                project.manifest.target
            );
            return window.aprismwarp.bridgeRequest('POST', '/api/v1/projects/save', {
                path: project.path,
                manifest: project.manifest,
                ir
            });
        },

        /**
         * Loads an .awp project through the host bridge and rebuilds the
         * AprismWarp blocks in the workspace. Returns the opened manifest.
         */
        loadProject: async function (path) {
            const opened = await window.aprismwarp.bridgeRequest(
                'POST', '/api/v1/projects/open', {path});
            const workspace = window.Blockly.getMainWorkspace();
            workspace.clear();
            const dom = window.Blockly.Xml.textToDom(irToWorkspaceXml(opened.ir));
            window.Blockly.Xml.domToWorkspace(dom, workspace);
            return opened;
        }
    };
}
