// @ts-check

// Script run within the webview itself.
(function () {

    // Get a reference to the VS Code webview api.
    // We use this API to post messages back to our extension.

    // @ts-ignore
    const vscode = acquireVsCodeApi();


    const notesContainer = /** @type {HTMLElement} */ (document.querySelector('tbody'));


    const errorContainer = document.createElement('div');
    document.body.appendChild(errorContainer);
    errorContainer.className = 'error'
    errorContainer.style.display = 'none'
    /**
     * Render the document in the webview.
     */
    let inputEvent = () => {
        let obj = {};
        let a = notesContainer.querySelectorAll('tr');
        for (let rule of a) {
            let inputs = rule.querySelectorAll('input');
            if (inputs[0].value && inputs[1].value) {
                obj[inputs[0].value] = {
                    value: inputs[1].value,
                    comment: inputs[2].value
                }
            }
        }
        vscode.setState({ text: JSON.stringify(obj) });
        vscode.postMessage({
            type: 'update',
            json: JSON.stringify(obj)
        });
    };

    let deleteEvent = (self) => {
        self.remove();
        let obj = {};
        let a = notesContainer.querySelectorAll('tr');
        for (let rule of a) {
            let inputs = rule.querySelectorAll('input');
            if (inputs[0].value && inputs[1].value) {
                obj[inputs[0].value] = {
                    value: inputs[1].value,
                    comment: inputs[2].value
                }
            }
        }
        vscode.setState({ text: JSON.stringify(obj) });
        vscode.postMessage({
            type: 'update',
            json: JSON.stringify(obj)
        });
    }
    document.querySelector('.plus').addEventListener('click', () => {
        const element = document.createElement('tr');
        notesContainer.appendChild(element);

        const name = document.createElement('td');
        const __name = document.createElement('input');
        __name.oninput = inputEvent;
        name.appendChild(__name);
        __name.value = '';
        const value = document.createElement('td');
        const _value = document.createElement('input');
        value.appendChild(_value);
        _value.value = '';
        _value.oninput = inputEvent;
        const comment = document.createElement('td');
        const _comment = document.createElement('input');
        comment.appendChild(_comment);
        _comment.value = '';
        _comment.oninput = inputEvent;
        const drop = document.createElement('td');
        drop.innerHTML = '&times;';
        drop.onclick = () => deleteEvent(element);
        element.append(name, value, comment, drop);
        name.focus();
        element.scrollIntoView();
    });
    function updateContent(/** @type {string} */ text) {
        let json;
        try {
            json = JSON.parse(text);
        } catch {
            notesContainer.style.display = 'none';
            errorContainer.innerText = 'Error: Document is not valid resx';
            errorContainer.style.display = '';
            return;
        }
        notesContainer.style.display = '';
        errorContainer.style.display = 'none';

        // Render the scratches
        notesContainer.innerHTML = '';
        for (const _name in json || []) {
            let rule = json[_name];
            const element = document.createElement('tr');
            notesContainer.appendChild(element);

            const name = document.createElement('td');
            const __name = document.createElement('input');
            __name.oninput = inputEvent;
            name.appendChild(__name);
            __name.value = _name;
            const value = document.createElement('td');
            const _value = document.createElement('input');
            value.appendChild(_value);
            _value.value = rule.value || '';
            _value.oninput = inputEvent;
            const comment = document.createElement('td');
            const _comment = document.createElement('input');
            comment.appendChild(_comment);
            _comment.value = rule.comment || '';
            _comment.oninput = inputEvent;
            const drop = document.createElement('td');
            drop.innerHTML = '&times;';
            drop.onclick = () => deleteEvent(element);
            element.append(name, value, comment, drop);
        }

    }

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'update':
                const text = message.text;
                if (text != vscode.getState()?.text) {
                    // Update our webview's content
                    updateContent(text);
                }
                // Then persist state information.
                // This state is returned in the call to `vscode.getState` below when a webview is reloaded.
                vscode.setState({ text });

                return;
        }
    });

    // Webviews are normally torn down when not visible and re-created when they become visible again.
    // State lets us save information across these re-loads
    const state = vscode.getState();
    if (state) {
        updateContent(state.text);
    }
}());