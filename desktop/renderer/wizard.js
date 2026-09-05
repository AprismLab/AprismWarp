'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const form = document.getElementById('wizard');
const errorBox = document.getElementById('error');
const createButton = document.getElementById('create');

form.addEventListener('submit', async event => {
    event.preventDefault();
    errorBox.textContent = '';
    createButton.disabled = true;
    const data = new FormData(form);
    const spec = {
        projectId: String(data.get('projectId') || '').trim(),
        name: String(data.get('name') || '').trim(),
        workType: String(data.get('workType') || ''),
        description: String(data.get('description') || '').trim(),
        author: String(data.get('author') || '').trim()
    };
    try {
        const created = await window.aprismwarp.bridgeRequest('POST', '/api/v1/projects/create', {spec});
        await window.aprismwarp.bridgeRequest('POST', '/api/v1/projects/open', {path: created.relativePath});
        const result = await window.aprismwarp.openEditor();
        if (!result.opened) {
            errorBox.textContent = result.error || 'Could not open the editor.';
            createButton.disabled = false;
        }
    } catch (error) {
        errorBox.textContent = error.message || String(error);
        createButton.disabled = false;
    }
});
