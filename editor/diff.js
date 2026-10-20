// @ts-check
(function () {
    // @ts-ignore Provided by VS Code.
    const vscode = acquireVsCodeApi();
    const body = document.querySelector('tbody');
    const search = document.getElementById('search');
    const unchanged = document.getElementById('unchanged');
    let entries = [];
    function render() {
        body.textContent = '';
        const query = search.value.toLocaleLowerCase();
        for (const entry of entries) {
            if (!unchanged.checked && entry.status === 'unchanged') { continue; }
            const text = [entry.key, entry.before?.value, entry.before?.comment, entry.after?.value, entry.after?.comment].join(' ').toLocaleLowerCase();
            if (!text.includes(query)) { continue; }
            const row = document.createElement('tr');
            row.className = entry.status;
            const key = document.createElement('td');
            key.textContent = `${entry.key}\n${entry.status}`;
            row.appendChild(key);
            for (const resource of [entry.before, entry.after]) {
                const cell = document.createElement('td');
                if (resource) {
                    const value = document.createElement('pre');
                    value.textContent = resource.value;
                    const comment = document.createElement('pre');
                    comment.className = 'comment';
                    comment.textContent = `Comment: ${resource.comment}`;
                    cell.append(value, comment);
                    if (!resource.editable) { cell.append('Typed/binary resource — inspect XML diff for full details.'); }
                } else { cell.textContent = 'Absent'; }
                row.appendChild(cell);
            }
            body.appendChild(row);
        }
        const count = status => entries.filter(entry => entry.status === status).length;
        document.getElementById('summary').textContent = `${count('added')} added · ${count('removed')} removed · ${count('changed')} changed · ${count('unchanged')} unchanged. XML formatting, attributes and non-resource metadata are available in the XML diff.`;
    }
    search.addEventListener('input', render);
    unchanged.addEventListener('change', render);
    document.getElementById('xml').addEventListener('click', () => vscode.postMessage({ type: 'xml' }));
    window.addEventListener('message', event => {
        if (event.data.type === 'diff') {
            entries = event.data.entries;
            document.getElementById('revision').textContent = event.data.revision;
            document.getElementById('error').textContent = '';
            render();
        } else if (event.data.type === 'error') {
            body.textContent = '';
            document.getElementById('error').textContent = event.data.message;
        }
    });
    vscode.postMessage({ type: 'ready' });
}());
