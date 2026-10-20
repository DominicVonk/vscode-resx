const assert = require('assert');
const { diffResources } = require('../out/diff');
const { sortResources } = require('../out/resources');
const data = (key, value, comment = '') => `<data name="${key}"><value>${value}</value><comment>${comment}</comment></data>`;
describe('resource diff and sorting', () => {
    it('compares by key and distinguishes missing from empty', () => {
        const before = `<root>${data('unchanged','a')}${data('changed','old')}${data('removed','')}</root>`;
        const after = `<root>${data('changed','new')}${data('added','')}${data('unchanged','a')}</root>`;
        assert.deepStrictEqual(diffResources(before, after).map(({ key, status }) => [key, status]), [
            ['added','added'], ['changed','changed'], ['removed','removed'], ['unchanged','unchanged']
        ]);
    });
    it('detects comment-only changes and ignores formatting/order', () => {
        assert.strictEqual(diffResources(`<root>${data('A','v','old')}</root>`, `<root>\n${data('A','v','new')}\n</root>`)[0].status, 'changed');
        assert.strictEqual(diffResources(`<root>${data('A','v')}</root>`, `<root>\n${data('A','v')}\n</root>`)[0].status, 'unchanged');
    });
    it('sorts whole resources while preserving metadata and whitespace', () => {
        const source = `<?xml version="1.0"?><root>\r\n<header/>\r\n${data('Z','  z\nline  ')}\r\n<!-- keep -->${data('A','a')}\r\n</root>`;
        const expected = `<?xml version="1.0"?><root>\r\n<header/>\r\n${data('A','a')}\r\n<!-- keep -->${data('Z','  z\nline  ')}\r\n</root>`;
        assert.strictEqual(sortResources(source), expected);
        assert.strictEqual(sortResources(expected), expected);
    });
});
