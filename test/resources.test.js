const assert = require('assert');
const { readResources, changeResource, resourceFamily } = require('../out/resources');
const change = (xml, key, field, value = '') => changeResource(xml, { key, field, value });
const xml = '<?xml version="1.0"?>\r\n<root>\r\n  <!-- keep -->\r\n  <resheader name="version"><value>2.0</value></resheader>\r\n  <data name="A" xml:space="preserve"><value>  first\nsecond  </value><comment>note\nline</comment></data>\r\n  <data name="Binary" type="System.Byte[]"><value>AAAA</value></data>\r\n</root>';
describe('resource edits', () => {
    it('saves a key-only resource with an empty value', () => {
        const result = change(xml, 'Empty', 'key', 'Empty');
        assert.deepStrictEqual(readResources(result).find(r => r.key === 'Empty'), { key: 'Empty', value: '', comment: '', editable: true });
    });
    it('preserves all unrelated XML and whitespace byte for byte', () => {
        assert.strictEqual(change(xml, 'A', 'value', 'new\nvalue'), xml.replace('<value>  first\nsecond  </value>', '<value>new\nvalue</value>'));
        assert.strictEqual(change(xml, 'A', 'value', '  first\nsecond  '), xml);
    });
    it('preserves XML whitespace, carriage returns, entities and CDATA semantics', () => {
        const value = ' \r\n<hello>&"\n ';
        const result = change(xml, 'A', 'value', value);
        assert.strictEqual(readResources(result)[0].value, value);
        assert.strictEqual(readResources('<root><data name="x"><value><![CDATA[ a\nb ]]></value></data></root>')[0].value, ' a\nb ');
    });
    it('handles comments, renames, deletions and self-closing nodes', () => {
        let result = '<root><data name="A"/><data name="B"><value/></data></root>';
        result = change(result, 'A', 'value', 'a');
        result = change(result, 'B', 'comment', 'comment');
        result = change(result, 'B', 'value', 'b');
        result = change(result, 'A', 'key', 'New');
        assert.deepStrictEqual(readResources(result).map(r => r.key), ['New', 'B']);
        assert.strictEqual(readResources(result)[1].comment, 'comment');
        result = change(result, 'New', 'delete');
        assert.deepStrictEqual(readResources(result).map(r => r.key), ['B']);
    });
    it('rejects invalid XML, duplicate/empty keys and edits of typed resources', () => {
        assert.throws(() => readResources('<root><data></root>'));
        assert.throws(() => readResources('<root><data name="A"/><data name="A"/></root>'));
        assert.throws(() => change(xml, 'Binary', 'value', 'corruption'));
        assert.throws(() => change(xml, 'A', 'key', 'Binary'));
        assert.throws(() => change(xml, 'A', 'key', ''));
    });
    it('groups only related sibling language filenames', () => {
        for (const name of ['Resources.resx', 'Resources.nl.resx', 'Resources.zh-Hant-TW.resx']) {
            assert.strictEqual(resourceFamily(name), 'Resources.resx');
        }
        assert.strictEqual(resourceFamily('Other.resx'), 'Other.resx');
        assert.strictEqual(resourceFamily('Resources.resw'), 'Resources.resw');
    });
});
describe('XML boundary cases', () => {
    it('adds to an empty self-closing root', () => {
        assert.strictEqual(readResources(change('<root/>', 'Empty', 'key', 'Empty'))[0].value, '');
    });
    it('preserves attributes on changed values and comments', () => {
        const source = '<root><data name="A"><value xml:space="preserve">old</value><comment xml:space="preserve"/></data></root>';
        assert.strictEqual(change(source, 'A', 'value', ' new '), source.replace('>old</value>', '> new </value>'));
        assert.strictEqual(change(source, 'A', 'comment', 'note'), source.replace('<comment xml:space="preserve"/>', '<comment xml:space="preserve">note</comment>'));
    });
    it('rejects a duplicate destination when adding a key', () => {
        assert.throws(() => change(xml, 'Missing', 'key', 'A'));
    });
});
