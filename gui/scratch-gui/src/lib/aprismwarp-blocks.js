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
        <block type="aprismwarp_schedule_repeat"><field name="INTERVALTICKS">20</field></block>`;
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

module.exports = {
    blockDefinitions,
    registerAprismWarpBlocks,
    extractAprismWarpIr,
    aprismWarpToolboxXML,
    WORK_TYPES
};

// Smoke/automation bridge (main world). Used by the Electron smoke gate.
if (typeof window !== 'undefined') {
    window.AprismWarpBlocks = {
        extractAprismWarpIr,
        aprismWarpToolboxXML,
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
            const ir = extractAprismWarpIr(
                workspace,
                window.APRISMWARP_WORK_TYPE || 'AprismJEMod',
                'smoke-project',
                {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'}
            );
            return JSON.stringify(ir);
        }
    };
}
