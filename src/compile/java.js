'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

/**
 * Returns the default fully-qualified entrypoint class name for an AWP
 * project. The name is derived from the project id so the generated
 * source compiles to a stable, package-friendly class.
 *
 * @param {string} projectId the AWP project id
 * @returns {string} FQCN, e.g. {@code com.example.project.MyMod}
 */
function defaultEntryClassName(projectId) {
    const safe = String(projectId || 'mod').replace(/[^A-Za-z0-9_]/g, '_');
    const head = safe.charAt(0).toUpperCase() + safe.slice(1);
    return `com.aprismwarp.generated.${head}Mod`;
}

/**
 * Stringifies a literal value for embedding in a Java source string. Only
 * primitives and strings are supported; unsupported values are escaped to
 * an explicit `null` so the generated source remains valid.
 *
 * @param {unknown} value
 * @returns {string}
 */
function toJavaLiteral(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return JSON.stringify(value);
    return 'null';
}

/**
 * Renders a Java identifier-safe method name from a block id. The result
 * always starts with a letter and contains only [A-Za-z0-9_].
 *
 * @param {string} id
 * @returns {string}
 */
function methodNameFromId(id, prefix) {
    const safe = String(id || 'handler').replace(/[^A-Za-z0-9_]/g, '_');
    const head = safe.charAt(0).toUpperCase() + safe.slice(1);
    return `${prefix}${head}`;
}

/**
 * Renders a Java source line for a single IR action. Only the v0.1
 * exportable actions are emitted; preview-only actions become a `// `
 * comment so the surrounding code remains valid.
 *
 * @param {object} action IR action node
 * @param {number} indent current indentation in spaces
 * @returns {string[]} one or more lines of Java
 */
function renderAction(action, indent) {
    const pad = ' '.repeat(indent);
    if (!action || typeof action !== 'object' || action.kind !== 'action') {
        return [`${pad}// skip: invalid action`];
    }
    if (action.action === 'log.info') {
        const message = typeof action.message === 'string' ? action.message : '';
        return [`${pad}ctx.getLogger().info(${toJavaLiteral(message)});`];
    }
    if (action.action === 'schedule.once'
        || action.action === 'schedule.repeat'
        || action.action === 'wait'
        || action.action === 'set-variable'
        || action.action === 'compare') {
        return [`${pad}// preview-only: ${action.action} (export blocked in IR v0.1)`];
    }
    return [`${pad}// unsupported action: ${action.action}`];
}

/**
 * Renders the body of a lifecycle or event handler method. The body is
 * indented by `indent` spaces and each emitted action gets its own line.
 *
 * @param {object} handler IR handler node
 * @param {number} indent
 * @returns {string[]}
 */
function renderHandlerBody(handler, indent) {
    if (!Array.isArray(handler.body)) return [];
    const lines = [];
    for (const action of handler.body) {
        lines.push(...renderAction(action, indent));
    }
    return lines;
}

/**
 * Renders the registration call for a typed content declaration. The
 * generated code uses {@code ctx.getItemRegistry()} or
 * {@code ctx.getBlockRegistry()} which throw {@code UnsupportedOperationException}
 * on the default Aprism context until a platform adapter binds them.
 *
 * @param {object} declaration IR declaration node
 * @returns {string[]}
 */
function renderDeclaration(declaration) {
    if (!declaration || declaration.kind !== 'declaration') return [];
    const id = JSON.stringify(declaration.id || '');
    if (declaration.declaration === 'item') {
        const maxStack = Number.isInteger(declaration.maxStack) ? declaration.maxStack : 64;
        return [
            '        ctx.getItemRegistry().register(',
            '            com.aprism.api.registry.ResourceKey.parse(' + id + '),',
            '            new com.aprism.api.registry.ItemContent(',
            '                com.aprism.api.registry.ResourceKey.parse(' + id + '),',
            '                ' + maxStack + '));'
        ];
    }
    if (declaration.declaration === 'block') {
        const hardness = Number.isFinite(declaration.hardness) ? declaration.hardness : 0.0;
        const resistance = Number.isFinite(declaration.resistance) ? declaration.resistance : 0.0;
        const luminance = Number.isInteger(declaration.luminance) ? declaration.luminance : 0;
        return [
            '        ctx.getBlockRegistry().register(',
            '            com.aprism.api.registry.ResourceKey.parse(' + id + '),',
            '            new com.aprism.api.registry.BlockContent(',
            '                com.aprism.api.registry.ResourceKey.parse(' + id + '),',
            '                ' + hardness + 'F,',
            '                ' + resistance + 'F,',
            '                ' + luminance + '));'
        ];
    }
    if (declaration.declaration === 'mod') {
        return ['        // project metadata: ' + (declaration.id || '')];
    }
    if (declaration.declaration === 'dependency') {
        return ['        // dependency: ' + (declaration.id || '')];
    }
    if (declaration.declaration === 'resource') {
        return ['        // resource: ' + (declaration.id || '')];
    }
    return ['        // unsupported declaration: ' + declaration.declaration];
}

/**
 * Renders the body of a single lifecycle method. The body is the union
 * of every handler whose {@code event} matches the lifecycle phase.
 *
 * @param {object} ir IR document
 * @param {string} phase e.g. {@code preinit}, {@code init}, {@code setup}, {@code complete}
 * @param {number} indent
 * @returns {string[]}
 */
function renderLifecycleBody(ir, phase, indent) {
    const lines = [];
    if (!ir || !Array.isArray(ir.handlers)) return lines;
    for (const handler of ir.handlers) {
        if (!handler || handler.kind !== 'event') continue;
        const event = handler.event;
        if ((event === 'lifecycle.preinit' && phase === 'preinit')
            || (event === 'lifecycle.init' && phase === 'init')
            || (event === 'lifecycle.setup' && phase === 'setup')
            || (event === 'lifecycle.complete' && phase === 'complete')) {
            lines.push(...renderHandlerBody(handler, indent));
        }
    }
    return lines;
}

/**
 * Returns a stable package name for the generated source. The package is
 * always {@code com.aprismwarp.generated} so the produced JAR does not
 * need to be signed against a customer-specific namespace.
 *
 * @returns {string}
 */
function generatedPackage() {
    return 'com.aprismwarp.generated';
}

/**
 * Renders the full Java source for an IAprismMod entrypoint class. The
 * source compiles against {@code com.aprism.api} only and never depends
 * on platform internals. The return value is a single Java source string
 * with stable line ordering for byte-deterministic output.
 *
 * @param {object} ir IR document
 * @param {object} [options]
 * @param {string} [options.entryClass] fully-qualified entry class name
 * @returns {string} Java source
 */
function generateJavaSource(ir, options = {}) {
    if (!ir || typeof ir !== 'object') {
        throw new Error('IR must be an object.');
    }
    const entryClass = options.entryClass || defaultEntryClassName(ir.projectId);
    let packageName;
    let className;
    const lastDot = entryClass.lastIndexOf('.');
    if (lastDot > 0) {
        packageName = entryClass.substring(0, lastDot);
        className = entryClass.substring(lastDot + 1);
    } else {
        packageName = generatedPackage();
        className = entryClass;
    }
    const projectId = String(ir.projectId || 'mod');

    const out = [];
    out.push('// generated by AprismWarp; do not edit by hand');
    out.push('package ' + packageName + ';');
    out.push('');
    out.push('import com.aprism.api.IAprismMod;');
    out.push('import com.aprism.api.AprismContext;');
    out.push('import com.aprism.api.AprismEventBus;');
    out.push('import com.aprism.api.AprismEvent;');
    out.push('import com.aprism.api.AprismEventListener;');
    out.push('import com.aprism.api.AprismRegistry;');
    out.push('import com.aprism.api.gameevent.GameTickEvent;');
    out.push('import com.aprism.api.gameevent.WorldLoadEvent;');
    out.push('import com.aprism.api.gameevent.WorldUnloadEvent;');
    out.push('import com.aprism.api.registry.ResourceKey;');
    out.push('import com.aprism.api.registry.ItemContent;');
    out.push('import com.aprism.api.registry.BlockContent;');
    out.push('');
    out.push('/**');
    out.push(' * Mod generated from AprismWarp project: ' + projectId);
    out.push(' * <p>The class is a thin adapter that maps the IR to Aprism\'s');
    out.push(' * typed registry and event surfaces.');
    out.push(' */');
    out.push('public final class ' + className + ' implements IAprismMod {');
    out.push('');
    out.push('    private AprismContext ctx;');
    out.push('');
    out.push('    @Override');
    out.push('    public void onPreInitialize(AprismContext ctx) {');
    out.push('        this.ctx = ctx;');
    for (const line of renderLifecycleBody(ir, 'preinit', 8)) out.push(line);
    out.push('    }');
    out.push('');
    out.push('    @Override');
    out.push('    public void onInitialize(AprismContext ctx) {');
    out.push('        this.ctx = ctx;');
    for (const declaration of ir.declarations || []) {
        for (const line of renderDeclaration(declaration)) out.push(line);
    }
    for (const line of renderLifecycleBody(ir, 'init', 8)) out.push(line);
    appendEventSubscriptions(ir, out);
    out.push('    }');
    out.push('');
    out.push('    @Override');
    out.push('    public void onSetup(AprismContext ctx) {');
    for (const line of renderLifecycleBody(ir, 'setup', 8)) out.push(line);
    out.push('    }');
    out.push('');
    out.push('    @Override');
    out.push('    public void onComplete(AprismContext ctx) {');
    for (const line of renderLifecycleBody(ir, 'complete', 8)) out.push(line);
    out.push('    }');

    if (Array.isArray(ir.handlers)) {
        for (const handler of ir.handlers) {
            if (!handler || handler.kind !== 'event') continue;
            if (typeof handler.event === 'string' && handler.event.startsWith('lifecycle.')) continue;
            renderEventHandler(handler, out);
        }
    }
    out.push('}');
    out.push('');
    return out.join('\n');
}

/**
 * Renders an event subscription block: a private static listener
 * inner class plus a registration call inside {@code onInitialize}. The
 * caller is responsible for indenting the registration correctly.
 *
 * @param {object} handler IR handler node
 * @param {string[]} out accumulator of source lines
 */
function renderEventHandler(handler, out) {
    const event = handler.event;
    if (event === 'game.tick') {
        const stage = handler.stage === 'START' ? 'START' : 'END';
        const methodName = methodNameFromId(handler.nodeId, 'onTick');
        out.push('');
        out.push('    private void ' + methodName + '(GameTickEvent event) {');
        for (const line of renderHandlerBody(handler, 8)) out.push(line);
        out.push('    }');
    } else if (event === 'world.load' || event === 'world.unload') {
        const methodName = methodNameFromId(handler.nodeId, event === 'world.load' ? 'onWorldLoad' : 'onWorldUnload');
        out.push('');
        out.push('    private void ' + methodName + '(AprismEvent event) {');
        for (const line of renderHandlerBody(handler, 8)) out.push(line);
        out.push('    }');
    } else {
        out.push('');
        out.push('    // unsupported event: ' + event);
    }
}

/**
 * Appends event subscriptions to the {@code onInitialize} body. Each
 * generated event handler has a matching subscription that filters by
 * event class (and tick stage for game.tick).
 *
 * @param {object} ir IR document
 * @param {string[]} out accumulator of source lines
 */
function appendEventSubscriptions(ir, out) {
    if (!Array.isArray(ir.handlers)) return;
    let gameTick = null;
    let worldLoad = null;
    let worldUnload = null;
    for (const handler of ir.handlers) {
        if (!handler || handler.kind !== 'event') continue;
        if (handler.event === 'game.tick') gameTick = handler;
        else if (handler.event === 'world.load') worldLoad = handler;
        else if (handler.event === 'world.unload') worldUnload = handler;
    }
    if (gameTick) {
        const methodName = methodNameFromId(gameTick.nodeId, 'onTick');
        out.push('        ctx.getEventBus().register(GameTickEvent.class, new AprismEventListener<GameTickEvent>() {');
        out.push('            @Override public void onEvent(GameTickEvent event) {');
        if (gameTick.stage === 'START') {
            out.push('                if (event.getStage() != GameTickEvent.Stage.START) return;');
        } else if (gameTick.stage === 'END') {
            out.push('                if (event.getStage() != GameTickEvent.Stage.END) return;');
        }
        out.push('                ' + methodName + '(event);');
        out.push('            }');
        out.push('        });');
    }
    if (worldLoad) {
        const methodName = methodNameFromId(worldLoad.nodeId, 'onWorldLoad');
        out.push('        ctx.getEventBus().register(WorldLoadEvent.class, new AprismEventListener<WorldLoadEvent>() {');
        out.push('            @Override public void onEvent(WorldLoadEvent event) {');
        out.push('                ' + methodName + '(event);');
        out.push('            }');
        out.push('        });');
    }
    if (worldUnload) {
        const methodName = methodNameFromId(worldUnload.nodeId, 'onWorldUnload');
        out.push('        ctx.getEventBus().register(WorldUnloadEvent.class, new AprismEventListener<WorldUnloadEvent>() {');
        out.push('            @Override public void onEvent(WorldUnloadEvent event) {');
        out.push('                ' + methodName + '(event);');
        out.push('            }');
        out.push('        });');
    }
}

/**
 * Extracts the package and class name from a Java source. Returns
 * {@code null} when no package or public class declaration can be
 * located.
 *
 * @param {string} source
 * @returns {{package: string, className: string}|null}
 */
function parseSourceTarget(source) {
    const packageMatch = source.match(/^\s*package\s+([A-Za-z0-9_.]+)\s*;/m);
    const classMatch = source.match(/^\s*public\s+(?:final\s+|abstract\s+)?class\s+([A-Za-z0-9_]+)/m);
    if (!classMatch) return null;
    return {
        package: packageMatch ? packageMatch[1] : '',
        className: classMatch[1]
    };
}

/**
 * Compiles a Java source buffer using a system {@code javac}. The
 * classpath is forwarded so generated code can resolve
 * {@code com.aprism.api.*} types. Returns the absolute paths of the
 * generated {@code .class} files on success. The source is written to
 * {@code outputDir/<package-path>/<className>.java} so javac can match
 * the class declaration against the file name.
 *
 * @param {string} source Java source
 * @param {string} outputDir destination directory for {@code .class} files
 * @param {object} [options]
 * @param {string} [options.classpath] extra classpath entries
 * @param {string} [options.javac] path to javac
 * @param {string} [options.apiClasspath] Aprism API classpath (e.g. aprism-api.jar)
 * @returns {{classFiles: string[], command: string[]}}
 */
function compileJava(source, outputDir, options = {}) {
    const target = parseSourceTarget(source);
    if (!target) {
        const err = new Error('cannot find a public class declaration in source');
        err.code = 'AWP-JAVA-002';
        err.statusCode = 500;
        throw err;
    }
    const packagePath = target.package ? target.package.replace(/\./g, path.sep) : '';
    const sourceDir = path.join(outputDir, packagePath);
    fs.mkdirSync(sourceDir, {recursive: true});
    const sourceFile = path.join(sourceDir, target.className + '.java');
    fs.writeFileSync(sourceFile, source);
    const javac = options.javac || 'javac';
    const args = ['--release', '17', '-d', outputDir];
    const classpathEntries = [];
    if (options.apiClasspath) classpathEntries.push(options.apiClasspath);
    if (options.classpath) classpathEntries.push(options.classpath);
    if (classpathEntries.length > 0) args.push('-classpath', classpathEntries.join(path.delimiter));
    args.push(sourceFile);
    const result = spawnSync(javac, args, {encoding: 'utf8'});
    if (result.status !== 0) {
        const err = new Error(`javac failed: ${(result.stderr || result.stdout || '').toString().trim() || 'unknown error'}`);
        err.code = 'AWP-JAVA-001';
        err.statusCode = 500;
        throw err;
    }
    const classFiles = fs.readdirSync(sourceDir)
        .filter(name => name.startsWith(target.className) && name.endsWith('.class') && !name.includes('$'))
        .map(name => path.join(sourceDir, name));
    return {classFiles, command: [javac, ...args]};
}

/**
 * Packages a directory of compiled {@code .class} files into a JAR. The
 * manifest declares the main entrypoint class when {@code entryClass} is
 * supplied, but Aprism mods are not standalone jars so the default
 * manifest is empty.
 *
 * @param {string} classDir directory containing {@code .class} files
 * @param {string} outputJar path of the produced JAR
 * @param {object} [options]
 * @param {string} [options.entryClass] optional Main-Class declaration
 * @returns {{entries: string[]}}
 */
function jarJava(classDir, outputJar, options = {}) {
    fs.mkdirSync(path.dirname(outputJar), {recursive: true});
    if (fs.existsSync(outputJar)) fs.unlinkSync(outputJar);
    const manifest = {
        'Manifest-Version': '1.0',
        'Built-By': 'AprismWarp'
    };
    if (options.entryClass) manifest['Main-Class'] = options.entryClass;
    const manifestBytes = Buffer.from(Object.entries(manifest).map(([k, v]) => `${k}: ${v}\n`).join('') + '\n');
    const files = walkClassFiles(classDir);
    const local = [];
    const central = [];
    let offset = 0;
    const localManifestHeader = (name, data, offsetValue) => {
        const nameBytes = Buffer.from(name, 'utf8');
        const header = Buffer.alloc(30 + nameBytes.length);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4);
        header.writeUInt16LE(0, 6);
        header.writeUInt16LE(0, 8);
        header.writeUInt16LE(0, 10);
        header.writeUInt16LE(0, 12);
        header.writeUInt32LE(crc32(data), 14);
        header.writeUInt32LE(data.length, 18);
        header.writeUInt32LE(data.length, 22);
        header.writeUInt16LE(nameBytes.length, 26);
        header.writeUInt16LE(0, 28);
        header.writeUInt16LE(0, 30);
        nameBytes.copy(header, 30);
        return {header, data, nameBytes, offset: offsetValue};
    };
    const manifestEntry = localManifestHeader('META-INF/MANIFEST.MF', manifestBytes, 0);
    local.push(manifestEntry.header, manifestEntry.data);
    central.push(makeCentralHeader(manifestEntry));
    offset = manifestEntry.header.length + manifestEntry.data.length;
    for (const file of files) {
        const relative = path.relative(classDir, file).replace(/\\/g, '/');
        const data = fs.readFileSync(file);
        const entry = localManifestHeader(relative, data, offset);
        local.push(entry.header, entry.data);
        central.push(makeCentralHeader(entry));
        offset += entry.header.length + entry.data.length;
    }
    const directory = Buffer.concat(central);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(files.length + 1, 8);
    eocd.writeUInt16LE(files.length + 1, 10);
    eocd.writeUInt32LE(directory.length, 12);
    eocd.writeUInt32LE(offset, 16);
    fs.writeFileSync(outputJar, Buffer.concat([...local, directory, eocd]));
    return {entries: ['META-INF/MANIFEST.MF', ...files.map(f => path.relative(classDir, f).replace(/\\/g, '/'))]};
}

function walkClassFiles(dir) {
    const out = [];
    const stack = [dir];
    while (stack.length > 0) {
        const current = stack.pop();
        for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) stack.push(full);
            else if (entry.isFile() && entry.name.endsWith('.class') && !entry.name.includes('$')) {
                out.push(full);
            }
        }
    }
    return out.sort();
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function makeCentralHeader(entry) {
    const header = Buffer.alloc(46 + entry.nameBytes.length);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0, 14);
    header.writeUInt32LE(crc32(entry.data), 16);
    header.writeUInt32LE(entry.data.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(entry.nameBytes.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt8(0, 38);
    header.writeUInt8(0, 39);
    header.writeUInt32LE(entry.offset, 42);
    entry.nameBytes.copy(header, 46);
    return header;
}

/**
 * Returns true when the system has a working {@code javac} reachable
 * on {@code PATH} (or the given override). The function shells out to
 * {@code javac -version} and returns true on exit code 0.
 *
 * @param {string} [javac] optional override path
 * @returns {boolean}
 */
function isJavacAvailable(javac) {
    const result = spawnSync(javac || 'javac', ['-version'], {encoding: 'utf8'});
    return result.status === 0;
}

/**
 * Resolves the path to the Aprism API jar. The search climbs up to six
 * parent directories and inspects each directory plus its siblings for
 * an {@code aprism-api/build/libs} folder. Returns {@code null} when no
 * jar is found so the caller can decide whether compilation is possible
 * at all.
 *
 * @param {string} [searchRoot] directory to search upward from
 * @returns {string|null} absolute path to the jar, or null when missing
 */
function resolveAprismApiJar(searchRoot) {
    const candidates = new Set();
    let dir = path.resolve(searchRoot || process.cwd());
    for (let depth = 0; depth < 6; depth += 1) {
        candidates.add(path.join(dir, 'aprism-api', 'build', 'libs'));
        const parent = path.dirname(dir);
        try {
            for (const sibling of fs.readdirSync(parent)) {
                candidates.add(path.join(parent, sibling, 'aprism-api', 'build', 'libs'));
            }
        } catch (error) {
            // ignore unreadable parents
        }
        if (parent === dir) break;
        dir = parent;
    }
    let latest = null;
    for (const candidate of candidates) {
        if (!fs.existsSync(candidate)) continue;
        const jars = fs.readdirSync(candidate).filter(name => name.startsWith('aprism-api-') && name.endsWith('.jar'));
        if (jars.length === 0) continue;
        jars.sort();
        const jar = path.join(candidate, jars[jars.length - 1]);
        if (!latest || jar > latest) latest = jar;
    }
    return latest;
}

module.exports = {
    generateJavaSource,
    compileJava,
    jarJava,
    isJavacAvailable,
    resolveAprismApiJar,
    parseSourceTarget,
    defaultEntryClassName
};
