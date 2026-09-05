'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const {validateIr, listVerifiedProfiles} = require('../ir/validate');
const {findVerifiedProfile} = require('../compile/target-profile');
const {defaultEntryClassName} = require('../compile/java');

const PROJECT_ID_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;
const WORK_TYPES = new Set(['AprismJEMod', 'AprismExtension']);
const TICK_STAGES = new Set(['START', 'END']);

const LIFECYCLE_EVENTS = [
    {id: 'lifecycle.preinit', label: 'when pre-init'},
    {id: 'lifecycle.init', label: 'when init'},
    {id: 'lifecycle.setup', label: 'when setup'},
    {id: 'lifecycle.complete', label: 'when complete'}
];
const GAME_EVENTS = [
    {id: 'game.tick', label: 'every game tick', stage: TICK_STAGES},
    {id: 'world.load', label: 'when world loads'},
    {id: 'world.unload', label: 'when world unloads'}
];
const DECLARATIONS = [
    {id: 'mod', label: 'mod metadata', fields: ['displayName', 'modVersion']},
    {id: 'dependency', label: 'dependency', fields: ['modId', 'range']},
    {id: 'item', label: 'item', fields: ['resourceKey', 'stackSize']},
    {id: 'block', label: 'block', fields: ['resourceKey']},
    {id: 'resource', label: 'resource file', fields: ['path']}
];
const ACTIONS = [
    {id: 'log.info', label: 'log info', previewOnly: false, fields: ['message']},
    {id: 'schedule.once', label: 'schedule once', previewOnly: true, fields: ['delayTicks']},
    {id: 'schedule.repeat', label: 'schedule repeat', previewOnly: true, fields: ['intervalTicks']},
    {id: 'wait', label: 'wait ticks', previewOnly: true, fields: ['delayTicks']},
    {id: 'set-variable', label: 'set variable', previewOnly: true, fields: ['name']},
    {id: 'compare', label: 'compare values', previewOnly: true, fields: ['operator']}
];

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

/**
 * Work-type-specific editor palettes. The GUI renders these as the
 * block palette for a newly created project; every entry maps to a
 * node the IR v0.1 validator accepts.
 */
const WORK_TYPE_PALETTES = Object.freeze({
    AprismJEMod: Object.freeze({
        events: Object.freeze([...LIFECYCLE_EVENTS, ...GAME_EVENTS]),
        declarations: Object.freeze(DECLARATIONS),
        actions: Object.freeze(ACTIONS)
    }),
    AprismExtension: Object.freeze({
        events: Object.freeze(LIFECYCLE_EVENTS),
        declarations: Object.freeze([]),
        actions: Object.freeze(ACTIONS.filter(action => action.id === 'log.info'))
    })
});

function wizardError(code, message) {
    const error = new Error(`${code}: ${message}`);
    error.code = code;
    return error;
}

/**
 * Creates a validated in-memory project for the no-project creation
 * wizard. The result feeds directly into writeAwp. The produced IR is
 * guaranteed to pass validateIr in preview mode for the declared work
 * type and a verified target profile.
 *
 * @param {{projectId: string, name: string, workType: string,
 *   minecraftVersion?: string, aprismVersion?: string,
 *   description?: string, author?: string}} spec wizard selections
 * @returns {{manifest: object, ir: object, editor: object|null, palette: object}}
 */
function createProject(spec) {
    if (!spec || typeof spec !== 'object') {
        throw wizardError('WIZ-001', 'wizard spec must be an object.');
    }
    if (typeof spec.projectId !== 'string' || !PROJECT_ID_PATTERN.test(spec.projectId)) {
        throw wizardError('WIZ-002', 'projectId must be a lowercase Aprism identifier.');
    }
    if (typeof spec.name !== 'string' || !spec.name.trim()) {
        throw wizardError('WIZ-003', 'name must be a non-empty string.');
    }
    if (!WORK_TYPES.has(spec.workType)) {
        throw wizardError('WIZ-004', 'workType must be AprismJEMod or AprismExtension.');
    }
    const target = {
        edition: 'JE',
        minecraft: spec.minecraftVersion || '26.2',
        aprism: spec.aprismVersion || 'v26.8-Alpha.7'
    };
    if (!findVerifiedProfile(target)) {
        const known = listVerifiedProfiles().map(p => `${p.minecraft}+${p.aprism}`).join(', ');
        throw wizardError('WIZ-005', `target profile ${target.minecraft} + ${target.aprism} is not verified. Known profiles: ${known}.`);
    }

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

    const manifest = {
        format: 'aprismwarp-project',
        schemaVersion: 1,
        projectId: spec.projectId,
        name: spec.name.trim(),
        workType: spec.workType,
        workProfile: {
            minecraftVersion: target.minecraft,
            aprismVersion: target.aprism,
            workType: spec.workType
        },
        target: {edition: target.edition, minecraft: target.minecraft, aprism: target.aprism},
        source: {editor: 'aprismwarp-native', project: 'editor/project.json', ir: 'ir/project.json'},
        extensions: {aepCapabilities: [], ajeCapabilities: [], aweEditors: []}
    };
    if (spec.description) manifest.description = spec.description.trim();
    if (spec.author) manifest.author = spec.author.trim();

    const ir = {
        irVersion: 1,
        projectId: spec.projectId,
        workType: spec.workType,
        target: {edition: target.edition, minecraft: target.minecraft, aprism: target.aprism},
        capabilities: ['basic'],
        declarations: [],
        handlers: []
    };
    if (spec.workType === 'AprismExtension') {
        ir.extension = {type: 'api', aprismRange: '>=26.8.0 <26.9.0'};
    } else {
        ir.handlers.push({
            nodeId: 'init-greeting',
            kind: 'event',
            event: 'lifecycle.init',
            body: [{
                nodeId: 'init-log',
                kind: 'action',
                action: 'log.info',
                message: `AprismWarp project ${spec.projectId} initialized.`
            }]
        });
        manifest.editor = {
            entrypoint: defaultEntryClassName(spec.projectId),
            displayName: manifest.name,
            description: manifest.description || `${manifest.name} created with AprismWarp.`,
            version: '0.1.0',
            environment: '*'
        };
    }

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

    const preview = validateIr(ir, {mode: 'preview'});
    if (!preview.valid) {
        const detail = preview.diagnostics.map(d => `${d.code} ${d.message}`).join('; ');
        throw wizardError('WIZ-006', `generated IR failed validation: ${detail}`);
    }
    return {manifest, ir, editor: manifest.editor || null, palette: WORK_TYPE_PALETTES[spec.workType]};
}

module.exports = {createProject, WORK_TYPE_PALETTES};
