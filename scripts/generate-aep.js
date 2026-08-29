'use strict';

const path = require('node:path');
const {generateAep, generateAepAndLock} = require('../src/compile/aep');

function usage() {
    console.error('Usage: node scripts/generate-aep.js <input.awp> <output.aep> [--lock] [--out <locked.awp>]');
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
            usage();
            return null;
        } else {
            positional.push(arg);
        }
    }
    return {positional, lock, out};
}

function main(argv) {
    const args = parseArgs(argv);
    if (!args) return;
    if (args.positional.length !== 2) {
        usage();
        return;
    }
    const awpPath = path.resolve(args.positional[0]);
    const aepPath = path.resolve(args.positional[1]);
    try {
        if (args.lock) {
            const result = generateAepAndLock(awpPath, aepPath, {awpOutPath: args.out});
            console.log(`AEP generated: ${aepPath}`);
            console.log(`Lock entry id=${result.lock.id} sha256=${result.lock.sha256}`);
            if (args.out) console.log(`Locked AWP written: ${args.out}`);
        } else {
            if (args.out) {
                console.error('generate-aep: --out requires --lock.');
                process.exitCode = 1;
                return;
            }
            const result = generateAep(awpPath, aepPath);
            console.log(`AEP generated: ${aepPath}`);
            for (const entry of result.entries) {
                console.log(`  ${entry}`);
            }
        }
    } catch (error) {
        console.error(`generate-aep failed: ${error.message}`);
        process.exitCode = 1;
    }
}

main(process.argv);
