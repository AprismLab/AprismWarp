'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

window.aprismwarp.getBridgeInfo().then(info => {
    const status = document.getElementById('status');
    return window.aprismwarp.bridgeRequest('GET', '/api/v1/status').then(status => {
        document.getElementById('status').textContent = `host bridge ready at ${info.bridgeUrl} (${status.status})`;
    });
}).catch(error => {
    const status = document.getElementById('status');
    status.textContent = `host bridge error: ${error.message}`;
});
