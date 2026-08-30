'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


const path = require('node:path');
const {generateAje, generateAjeAndLock, generateAjeAndBuild} = require('../src/compile/aje');
const {configureSchemaPaths} = require('../src/awp/archive');

const repoRoot = path.resolve(__dirname, '..');
configureSchemaPaths({
    awpManifestSchemaPath: path.join(repoRoot, 'schemas', 'awp.schema.json'),
    irSchemaPath: path.join(repoRoot, 'schemas', 'ir.schema.json')
});

function usage() {
    console.error('Usage: node scripts/generate-aje.js <input.awp> <output.aje>');
    console.error('       [--lock] [--out <locked.awp>]');
    console.error('       [--build] [--api-jar <aprism-api.jar>] [--javac <javac-bin>]');
    process.exitCode = 2;
}

function parseArgs(argv) {
    const out = {
        positional: [],
        lock: false,
        build: false,
        out: null,
        apiJar: null,
        javac: null
    };
    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--lock') out.lock = true;
        else if (arg === '--build') out.build = true;
        else if (arg === '--out') out.out = argv[++i];
        else if (arg === '--api-jar') out.apiJar = argv[++i];
        else if (arg === '--javac') out.javac = argv[++i];
        else if (arg === '--help' || arg === '-h') return null;
        else positional.push(arg);
    }
    out.positional = out.positional;
    return out;
}
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

function main(argv) {
    const args = parseArgs(argv);
    if (!args) {
        usage();
        return;
    }
    if (args.positional.length !== 2) {
        usage();
        return;
    }
    const awpPath = path.resolve(args.positional[0]);
    const ajePath = path.resolve(args.positional[1]);
    try {
        if (args.lock) {
            const result = generateAjeAndLock(awpPath, ajePath, {awpOutPath: args.out});
            console.log(`AJE generated: ${ajePath}`);
            console.log(`Lock entry id=${result.lock.id} sha256=${result.lock.sha256}`);
            if (args.out) console.log(`Locked AWP written: ${args.out}`);
        } else if (args.build) {
            const result = generateAjeAndBuild(awpPath, ajePath, {
                awpOutPath: args.out,
                apiJar: args.apiJar,
                javac: args.javac
            });
            console.log(`AJE generated: ${ajePath}`);
            if (result.built) console.log('Mod main jar was built from IR via javac.');
            for (const entry of result.entries || []) console.log(`  ${entry}`);
            if (result.checksumsPath) console.log(`Checksums: ${result.checksumsPath}`);
        } else {
            if (args.out) {
                console.error('generate-aje: --out requires --lock or --build.');
                process.exitCode = 1;
                return;
            }
            const result = generateAje(awpPath, ajePath);
            console.log(`AJE generated: ${ajePath}`);
            for (const entry of result.entries) {
                console.log(`  ${entry}`);
            }
            console.log(`Checksums: ${result.checksumsPath}`);
        }
    } catch (error) {
        console.error(`generate-aje failed: ${error.message}`);
        process.exitCode = 1;
    }
}

main(process.argv);

