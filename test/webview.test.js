const assert = require('assert');
const fs = require('fs');
const { JSDOM } = require('jsdom');
function webview(file, html) {
    const dom = new JSDOM(html, { runScripts: 'outside-only' });
    const messages = [];
    dom.window.acquireVsCodeApi = () => ({ postMessage: message => messages.push(message) });
    dom.window.HTMLElement.prototype.scrollIntoView = () => {};
    dom.window.eval(fs.readFileSync(`editor/${file}.js`, 'utf8'));
    return { window: dom.window, document: dom.window.document, messages, update: data => dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data })) };
}
describe('editor webviews', () => {
    it('groups files, commits key-only rows, preserves multiline values and searches comments', () => {
        const view = webview('resx', '<button id="git"></button><button id="xml"></button><input id="search"><p id="error"></p><table><thead></thead><tbody></tbody></table><button id="add"></button>');
        const files = [{uri:'file:///A.resx',name:'A.resx',resources:[{key:'Key',value:'  line\nnext  ',comment:'findme',editable:true}]},
            {uri:'file:///A.nl.resx',name:'A.nl.resx',resources:[]}];
        view.update({ type:'update',files });
        assert.strictEqual(view.document.querySelectorAll('th').length, 3);
        assert.strictEqual(view.document.querySelector('textarea').value, '  line\nnext  ');
        view.document.getElementById('add').click();
        const key = view.document.querySelector('tbody tr:last-child input');
        key.value = 'Empty';
        key.dispatchEvent(new view.window.Event('input'));
        assert.deepStrictEqual(JSON.parse(JSON.stringify(view.messages[1])), {uri:'file:///A.resx',key:'Empty',field:'key',value:'Empty'});
        const search = view.document.getElementById('search');
        search.value = 'findme'; search.dispatchEvent(new view.window.Event('input'));
        assert.strictEqual(view.document.querySelector('tbody tr').hidden, false);
        search.value = 'absent'; search.dispatchEvent(new view.window.Event('input'));
        assert.strictEqual(view.document.querySelector('tbody tr').hidden, true);
        view.document.getElementById('xml').click();
        assert.strictEqual(view.messages[2].type,'xml');
        view.window.close();
    });
    it('renders safe, searchable Git changes and toggles unchanged entries', () => {
        const view = webview('diff', '<input id="search"><input type="checkbox" id="unchanged"><button id="xml"></button><p id="summary"></p><p id="error"></p><p id="revision"></p><table><tbody></tbody></table>');
        view.update({type:'diff',revision:'test',entries:[{key:'<script>',status:'added',after:{value:'<img onerror="bad()">',comment:'needle'}},{key:'same',status:'unchanged',before:{value:'a',comment:''},after:{value:'a',comment:''}}]});
        assert.strictEqual(view.document.querySelectorAll('tbody tr').length,1);
        assert.strictEqual(view.document.querySelectorAll('script,img').length,0);
        const toggle = view.document.getElementById('unchanged');toggle.checked = true;toggle.dispatchEvent(new view.window.Event('change'));
        assert.strictEqual(view.document.querySelectorAll('tbody tr').length,2);
        const search = view.document.getElementById('search'); search.value='needle';search.dispatchEvent(new view.window.Event('input'));
        assert.strictEqual(view.document.querySelectorAll('tbody tr').length,1);
        view.window.close();
    });
});
