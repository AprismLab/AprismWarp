'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {generateAjeAndLock} = require('../compile/aje');

const BRIDGE_SCHEMA = 'aprismwarp.bridge/v1';
const ERROR_SCHEMA = 'aprismwarp.bridge-error/v1';
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Validates that the configured host is a loopback address. Anything else is
 * rejected so the bridge never binds to a public interface by accident.
 *
 * @param {string} host hostname to validate
 * @returns {boolean} true when the host is loopback
 */
function isLoopbackHost(host) {
    return LOOPBACK_HOSTS.has(host);
}

/**
 * Generates a per-session opaque token using 32 bytes from a CSPRNG.
 *
 * @returns {string} hex token, 64 characters
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Resolves the client's remote address into a string and rejects any host
 * that is not loopback. The bridge must only serve local clients.
 *
 * @param {http.IncomingMessage} req the request
 * @returns {string} the verified remote address
 */
function verifyLoopbackPeer(req) {
    const remote = (req.socket && req.socket.remoteAddress) || '';
    if (!isLoopbackHost(remote)) {
        const err = new Error(`bridge rejects remote address: ${remote}`);
        err.code = 'BRIDGE-NET-001';
        err.statusCode = 403;
        throw err;
    }
    return remote;
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover




/**
 * Reads the request body into a buffer with a size limit. The body is
 * expected to be UTF-8 JSON.
 *
 * @param {http.IncomingMessage} req the request
 * @returns {Promise<Buffer>} raw body bytes
 */
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        req.on('data', chunk => {
            total += chunk.length;
            if (total > MAX_BODY_BYTES) {
                req.destroy();
                const error = new Error(`request body exceeds ${MAX_BODY_BYTES} bytes`);
                error.code = 'BRIDGE-NET-002';
                error.statusCode = 413;
                reject(error);
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

/**
 * Compares two strings in constant time to defeat timing side-channels.
 *
 * @param {string} a first string
 * @param {string} b second string
 * @returns {boolean} true when the strings have equal length and bytes
 */
function constantTimeEquals(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

/**
 * Extracts the bearer token from the Authorization header, returning null
 * when the header is absent or malformed.
 *
 * @param {http.IncomingMessage} req the request
 * @returns {string|null} the bearer token
 */
function extractBearerToken(req) {


    const header = req.headers.authorization || req.headers.Authorization;
    if (typeof header !== 'string') return null;
    if (!header.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length).trim() || null;
}

/**
 * Returns a JSON-serialisable capability object describing what the
 * bridge currently exposes. The flags here are advisory: every handler
 * still validates its own request body.
 *
 * @param {object} options runtime options passed to {@link start}
 * @returns {object} capability payload
 */
function buildCapabilityPayload(options = {}) {
    return {
        schema: BRIDGE_SCHEMA,
        bridgeVersion: '0.1.0',
        capabilities: {
            compiler: {
                validate: typeof options.validateIr === 'function',
                packageAje: typeof options.packageAje === 'function',
                packageAep: typeof options.packageAep === 'function'
            },
            mdl: {create: false, launch: false, logs: false},
            despotes: {status: false, screenshot: false}
        }
    };
}

/**
 * Wraps a handler return value into a successful JSON response. Errors
 * thrown by handlers are caught by {@link dispatchRequest}.
 *
 * @param {object} payload
 * @returns {object} response body
 */
function wrapSuccess(payload) {
    return payload;
}
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

/**
 * Wraps an error into the bridge error envelope. Status code falls back
 * to 500 when the error does not declare one.
 *
 * @param {Error} error
 * @returns {{status: number, body: object}}
 */
function wrapError(error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;


    const code = typeof error.code === 'string' ? error.code : 'BRIDGE-INT-001';
    const message = error.exposeMessage === false ? 'internal error' : (error.message || 'internal error');
    return {
        status: statusCode,
        body: {schema: ERROR_SCHEMA, code, message, retryable: false, details: {}}
    };
}

/**
 * Dispatches a single HTTP request to the matching handler. Each handler
 * receives a normalised context and returns a serialisable payload.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Map<string, Function>} routes method+path -> handler
 * @param {object} context bridge context (token, dispatch, etc.)
 */
async function dispatchRequest(req, res, routes, context) {
    const key = `${req.method.toUpperCase()} ${req.url.split('?')[0]}`;
    const handler = routes.get(key);
    if (!handler) {
        const error = new Error(`no handler for ${key}`);
        error.code = 'BRIDGE-INT-002';
        error.statusCode = 404;
        throw error;
    }
    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        const raw = await readBody(req);
        if (raw.length > 0) {
            try {
                body = JSON.parse(raw.toString('utf8'));
            } catch (error) {
                const err = new Error(`invalid JSON body: ${error.message}`);
                err.code = 'BRIDGE-NET-003';
                err.statusCode = 400;
                throw err;
            }
        }
    }
    return await handler({body, context});
}
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

/**
 * Validates a path argument does not escape a root directory.
 *
 * @param {string} root the project/artifact root directory
 * @param {string} candidate the candidate path
 * @returns {string} resolved safe path
 */


function safePath(root, candidate) {
    if (typeof candidate !== 'string' || !candidate) {
        const error = new Error('path is required');
        error.code = 'BRIDGE-FS-001';
        error.statusCode = 400;
        throw error;
    }
    if (candidate.includes('\\') || candidate.split('/').includes('..') || candidate.startsWith('/')) {
        const error = new Error('path traversal is not allowed');
        error.code = 'BRIDGE-FS-002';
        error.statusCode = 400;
        throw error;
    }
    const resolved = path.resolve(root, candidate);
    const rootResolved = path.resolve(root);
    const relative = path.relative(rootResolved, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        const error = new Error('path escapes configured root');
        error.code = 'BRIDGE-FS-003';
        error.statusCode = 400;
        throw error;
    }
    return resolved;
}

/**
 * Creates the default route table wired to the supplied handler
 * implementations. The bridge exposes only the endpoints that have a
 * non-null handler.
 *
 * @param {object} handlers handler overrides
 * @returns {Map<string, Function>} route table
 */
function buildRoutes(handlers) {
    const routes = new Map();
    const use = (method, path, handler) => {
        if (typeof handler === 'function') routes.set(`${method} ${path}`, handler);
    };
    use('GET', '/api/v1/capabilities', () => wrapSuccess(handlers.capabilities()));
    use('GET', '/api/v1/status', () => wrapSuccess(handlers.status()));
    use('POST', '/api/v1/projects/validate', ({body}) => wrapSuccess(handlers.validateIr(body)));
    use('POST', '/api/v1/projects/package', ({body}) => wrapSuccess(handlers.packageAje(body)));

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

    return routes;
}

/**
 * Resolves the public host for the bridge. The default is `127.0.0.1`,
 * which is the only allowed value in v0.1.
 *
 * @param {string|undefined} candidate


 * @returns {string} the resolved loopback host
 */
function resolveHost(candidate) {
    const host = candidate || '127.0.0.1';
    if (!isLoopbackHost(host)) {
        const error = new Error(`bridge refuses non-loopback host: ${host}`);
        error.code = 'BRIDGE-NET-004';
        error.statusCode = 400;
        throw error;
    }
    return host;
}

/**
 * Starts the bridge HTTP server on a loopback address. The returned
 * handle exposes the assigned port, generated token, and shutdown
 * function. The server is locked to loopback peers and the bearer token
 * is required for every request.
 *
 * @param {object} [options] configuration overrides
 * @returns {Promise<{host: string, port: number, token: string, close: Function, request: Function}>}
 */
function start(options = {}) {
    const host = resolveHost(options.host);
    const token = generateToken();
    const routes = buildRoutes({
        capabilities: () => buildCapabilityPayload(options),
        status: () => wrapSuccess({
            schema: BRIDGE_SCHEMA,
            status: 'ok',
            uptimeMs: Math.round(process.uptime() * 1000)
        }),
        validateIr: (body) => {
            if (!body || !body.ir) {
                const error = new Error('validate requires an `ir` field');
                error.code = 'BRIDGE-VAL-001';
                error.statusCode = 400;
                throw error;
            }
            return options.validateIr(body);

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

        },
        packageAje: (body) => {
            if (!body || !body.awpPath || !body.outputPath) {
                const error = new Error('package requires awpPath and outputPath');
                error.code = 'BRIDGE-PKG-001';
                error.statusCode = 400;
                throw error;
            }
            const outputPath = safePath(options.artifactRoot || process.cwd(), body.outputPath);
            const result = options.packageAje({


                awpPath: path.resolve(body.awpPath),
                outputPath,
                lock: body.lock !== false
            });
            return wrapSuccess(result);
        }
    });

    const server = http.createServer(async (req, res) => {
        try {
            verifyLoopbackPeer(req);
            const providedToken = extractBearerToken(req);
            if (!providedToken) {
                const error = new Error('missing bearer token');
                error.code = 'BRIDGE-AUTH-001';
                error.statusCode = 401;
                throw error;
            }
            if (!constantTimeEquals(providedToken, token)) {
                const error = new Error('invalid bearer token');
                error.code = 'BRIDGE-AUTH-002';
                error.statusCode = 403;
                throw error;
            }
            const payload = await dispatchRequest(req, res, routes, {token});
            res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
            res.end(JSON.stringify(payload));
        } catch (error) {
            const wrapped = wrapError(error);
            res.writeHead(wrapped.status, {'Content-Type': 'application/json; charset=utf-8'});
            res.end(JSON.stringify(wrapped.body));
        }
    });
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

    return new Promise((resolve, reject) => {
        const listenPort = Number.isInteger(options.port) ? options.port : 0;
        server.once('error', reject);
        server.listen(listenPort, host, () => {
            const address = server.address();
            const port = address && typeof address === 'object' ? address.port : listenPort;
            const close = () => new Promise(resolveClose => server.close(() => resolveClose()));
            resolve({host, port, token, close});
        });
    });
}

/**
 * Convenience helper used by the bridge client. Sends a JSON request
 * using the bound handle.
 *


 * @param {object} handle bridge handle from {@link start}
 * @param {string} method HTTP method
 * @param {string} path request path
 * @param {object} [body] optional JSON body
 * @returns {Promise<object>} parsed JSON response
 */
async function request(handle, method, path, body) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? '' : JSON.stringify(body);
        const req = http.request({
            host: handle.host,
            port: handle.port,
            method,
            path,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(payload, 'utf8'),
                'Authorization': `Bearer ${handle.token}`
            }
        }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                if (res.statusCode >= 400) {
                    const error = new Error(`bridge error: ${res.statusCode}: ${text}`);
                    error.statusCode = res.statusCode;
                    error.body = text;
                    reject(error);
                    return;
                }
                try {
                    resolve(text ? JSON.parse(text) : null);
                } catch (error) {
                    reject(error);
                }

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

module.exports = {start, request, isLoopbackHost, generateToken, BRIDGE_SCHEMA, ERROR_SCHEMA};

