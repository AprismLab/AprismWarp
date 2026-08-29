'use strict';

const path = require('node:path');
const {generateAje, generateAjeAndLock} = require('../src/compile/aje');

function usage() {
    console.error('Usage: node scripts/generate-aje.js <input.awp> <output.aje> [--lock] [--out <locked.awp>]');
    process.exitCode = 2;
}

function parseArgs(argv) {
    const positional = [];
    let lock = false;
    let out = null;
    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--lock') {
            lock = true;
        } else if (arg === '--out') {
            out = argv[++i];
        } else if (arg === '--help' || arg === '-h') {
            return null;
        } else {
            positional.push(arg);
        }
    }
    return {positional, lock, out};
}

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
        } else {
            if (args.out) {
                console.error('generate-aje: --out requires --lock.');
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
