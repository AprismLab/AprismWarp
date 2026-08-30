'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

// Minimal stored-entry ZIP writer used by AWE fixture tests.
function buildAwe(manifest, extraEntries = []) {
    const chunks = [];
    const central = [];
    let offset = 0;
    const put = (name, data) => {
        const nameBytes = Buffer.from(name, 'utf8');
        const crcTable = [];
        for (let n = 0; n < 256; n += 1) {
            let c = n;
            for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            crcTable[n] = c >>> 0;
        }
        let crc = 0xffffffff;
        for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
        crc = (crc ^ 0xffffffff) >>> 0;
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(0, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        chunks.push(local, nameBytes, data);
        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(data.length, 20);
        centralHeader.writeUInt32LE(data.length, 24);
        centralHeader.writeUInt16LE(nameBytes.length, 28);
        centralHeader.writeUInt32LE(offset, 42);
        central.push(centralHeader, nameBytes);
        offset += 30 + nameBytes.length + data.length;
    };
    if (manifest !== null) put('aprismwarp.extension.json', Buffer.from(JSON.stringify(manifest)));
    for (const [name, data] of extraEntries) {
        put(name, typeof data === 'string' ? Buffer.from(data) : data);
    }
    const centralStart = offset;
    let centralSize = 0;
    for (const chunk of central) centralSize += chunk.length;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(central.length / 2, 8);
    eocd.writeUInt16LE(central.length / 2, 10);
    eocd.writeUInt32LE(centralSize, 12);
    eocd.writeUInt32LE(centralStart, 16);
    return Buffer.concat([...chunks, ...central, eocd]);
}

module.exports = {buildAwe};
