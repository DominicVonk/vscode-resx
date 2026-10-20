// @ts-check
(function () {
    // @ts-ignore VS Code supplies this API in the webview.
    const vscode = acquireVsCodeApi();
    const body = document.querySelector('tbody');
    const head = document.querySelector('thead');
    const error = document.getElementById('error');
    let files = [];
    let latest = [];
    function send(uri, key, field, value) {
        error.hidden = true;
        vscode.postMessage({ uri, key, field, value });
    }
    function input(cell, value, label, multiline, oninput, disabled) {
        const control = document.createElement(multiline ? 'textarea' : 'input');
        control.value = value;
        control.setAttribute('aria-label', label);
        control.disabled = disabled;
        control.addEventListener('input', () => oninput(control.value));
        cell.appendChild(control);
        return control;
    }
    function render() {
        files = latest;
        head.textContent = '';
        body.textContent = '';
        const header = document.createElement('tr');
        for (const title of ['Key', ...files.map(file => file.name)]) {
            const th = document.createElement('th');
            th.textContent = title;
            header.appendChild(th);
        }
        head.appendChild(header);
        const keys = new Set();
        files.forEach(file => file.resources.forEach(resource => keys.add(resource.key)));
        keys.forEach(key => addRow(key));
        filter();
    }
    function addRow(initialKey) {
        let key = initialKey;
        const row = document.createElement('tr');
        const keyCell = document.createElement('td');
        row.appendChild(keyCell);
        // Renaming is per file: language files can intentionally have different key sets.
        keyCell.textContent = key;
        for (const file of files) {
            let resource = file.resources.find(item => item.key === initialKey);
            const cell = document.createElement('td');
            row.appendChild(cell);
            const name = input(cell, initialKey, `Key in ${file.name}`, false, value => {
                if (!value || file.resources.some(item => item !== resource && item.key === value)) {
                    error.textContent = 'Enter a nonempty, unique key.'; error.hidden = false; return;
                }
                send(file.uri, resource ? resource.key : value, 'key', value);
                if (resource) { resource.key = value; }
                else {
                    resource = { key: value, value: '', comment: '', editable: true };
                    file.resources.push(resource);
                }
                remove.disabled = false;
            }, resource && !resource.editable);
            name.placeholder = 'New key';
            name.title = 'Rename or add this key in this file';
            for (const field of ['value', 'comment']) {
                const control = input(cell, resource ? resource[field] : '', `${field} in ${file.name}`, true, value => {
                    const currentKey = resource ? resource.key : key;
                    if (!currentKey) { error.textContent = 'Enter a key first.'; error.hidden = false; return; }
                    send(file.uri, currentKey, field, value);
                    if (!resource) {
                        resource = { key: currentKey, value: '', comment: '', editable: true };
                        file.resources.push(resource);
                    }
                    resource[field] = value;
                    remove.disabled = false;
                }, resource && !resource.editable);
                control.placeholder = field === 'value' ? 'Value' : 'Comment';
            }
            const remove = document.createElement('button');
            remove.textContent = 'Delete';
            remove.disabled = !resource || !resource.editable;
            remove.addEventListener('click', () => {
                if (resource && window.confirm(`Delete ${resource.key} from ${file.name}?`)) {
                    send(file.uri, resource.key, 'delete', '');
                    cell.textContent = '';
                }
            });
            cell.appendChild(remove);
        }
        body.appendChild(row);
        return row;
    }
    function filter() {
        const query = document.getElementById('search').value.toLocaleLowerCase();
        for (const row of body.querySelectorAll('tr')) {
            const text = [row.firstChild.textContent, ...Array.from(row.querySelectorAll('input,textarea')).map(control => control.value)].join(' ').toLocaleLowerCase();
            row.hidden = !text.includes(query);
        }
    }
    document.getElementById('search').addEventListener('input', filter);
    document.getElementById('git').addEventListener('click', () => vscode.postMessage({ type: 'git' }));
    document.getElementById('xml').addEventListener('click', () => vscode.postMessage({ type: 'xml' }));
    document.getElementById('add').addEventListener('click', () => {
        const row = addRow('');
        row.querySelector('input').focus();
        row.scrollIntoView();
    });
    window.addEventListener('message', event => {
        if (event.data.type === 'error') {
            error.textContent = event.data.message;
            error.hidden = false;
        } else if (event.data.type === 'update') {
            latest = event.data.files;
            if (!body.contains(document.activeElement)) { render(); }
        }
    });
    vscode.postMessage({ type: 'ready' });
    body.addEventListener('focusout', () => {
        setTimeout(() => { if (!body.contains(document.activeElement)) { render(); } }, 0);
    });
}());
