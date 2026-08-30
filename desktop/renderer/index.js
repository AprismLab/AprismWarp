'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

window.aprismwarp.getBridgeInfo().then(info => {
    const status = document.getElementById('status');
    status.textContent = `host bridge ready at ${info.bridgeUrl}`;
}).catch(error => {
    const status = document.getElementById('status');
    status.textContent = `host bridge error: ${error.message}`;
});
