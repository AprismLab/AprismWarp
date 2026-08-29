'use strict';

const path = require('node:path');
const {start} = require('../src/bridge/server');
const {validateIr} = require('../src/ir/validate');
const {readAwp} = require('../src/awp/archive');
const {generateAjeAndLock} = require('../src/compile/aje');

function usage() {
    console.error('Usage: node scripts/host-bridge.js [--port <port>] [--host <host>] [--artifact-root <dir>]');
    console.error('  Starts the AprismWarp host bridge on the given loopback interface.');
    process.exitCode = 2;
}

function parseArgs(argv) {
    const out = {port: undefined, host: undefined, artifactRoot: undefined};
    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--port') out.port = Number(argv[++i]);
        else if (arg === '--host') out.host = argv[++i];
        else if (arg === '--artifact-root') out.artifactRoot = argv[++i];
        else if (arg === '--help' || arg === '-h') return null;
        else {
            console.error(`host-bridge: unknown argument: ${arg}`);
            return null;
        }
    }
    return out;
}

function handleValidateIr(body) {
    if (!body || !body.ir) {
        const error = new Error('validate requires an `ir` field');
        error.code = 'BRIDGE-VAL-001';
        error.statusCode = 400;
        throw error;
    }
    const result = validateIr(body.ir, {mode: body.mode || 'export'});
    return {valid: result.valid, diagnostics: result.diagnostics};
}

function handlePackageAje(args) {
    const awpPath = path.resolve(args.awpPath);
    const outputPath = path.resolve(args.outputPath);
    const irProject = readAwp(awpPath);
    if (irProject.manifest.workType !== 'AprismJEMod') {
        const error = new Error(`workType must be AprismJEMod; got "${irProject.manifest.workType}"`);
        error.code = 'BRIDGE-PKG-002';
        error.statusCode = 400;
        throw error;
    }
    const result = generateAjeAndLock(awpPath, outputPath, {awpOutPath: undefined, updateAwp: args.lock !== false});
    return {manifest: result.manifest, lock: result.lock, outputPath, checksumsPath: result.checksumsPath};
}

async function main(argv) {
    const args = parseArgs(argv);
    if (!args) {
        usage();
        return;
    }
    try {
        const handle = await start({
            host: args.host,
            port: args.port,
            artifactRoot: args.artifactRoot ? path.resolve(args.artifactRoot) : process.cwd(),
            validateIr: handleValidateIr,
            packageAje: handlePackageAje
        });
        console.log(`AprismWarp host bridge ready: http://${handle.host}:${handle.port}`);
        console.log(`Authorization: Bearer ${handle.token}`);
        console.log('Press Ctrl+C to stop.');
        const shutdown = async signal => {
            console.log(`Received ${signal}, shutting down.`);
            await handle.close();
            process.exit(0);
        };
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    } catch (error) {
        console.error(`host-bridge failed: ${error.message}`);
        process.exitCode = 1;
    }
}

main(process.argv);
