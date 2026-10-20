import * as sax from 'sax';

interface Element {
    name: string;
    attributes: { [key: string]: string };
    start: number;
    contentStart: number;
    contentEnd: number;
    end: number;
    text: string;
    children: Element[];
    selfClosing: boolean;
}
export interface Resource {
    key: string;
    value: string;
    comment: string;
    editable: boolean;
}
function parse(xml: string): Element {
    const parser = sax.parser(true, { trim: false, normalize: false });
    const stack: Element[] = [];
    let root: Element | undefined;
    parser.onopentag = tag => {
        const element: Element = {
            name: tag.name, attributes: {}, start: xml.lastIndexOf('<', parser.position - 1),
            contentStart: parser.position, contentEnd: parser.position, end: parser.position,
            text: '', children: [], selfClosing: tag.isSelfClosing
        };
        for (const name of Object.keys(tag.attributes)) {
            const attribute = tag.attributes[name];
            element.attributes[name] = typeof attribute === 'string' ? attribute : attribute.value;
        }
        if (stack.length) { stack[stack.length - 1].children.push(element); }
        else { root = element; }
        stack.push(element);
    };
    parser.ontext = parser.oncdata = text => {
        if (stack.length) { stack[stack.length - 1].text += text; }
    };
    parser.onclosetag = () => {
        const element = stack.pop();
        if (element) {
            element.contentEnd = element.selfClosing ? element.contentStart : xml.lastIndexOf('</', parser.position - 1);
            element.end = parser.position;
        }
    };
    parser.write(xml).close();
    if (!root || root.name !== 'root') { throw new Error('Expected a <root> resource document.'); }
    const names = new Set<string>();
    for (const element of root.children.filter(child => child.name === 'data')) {
        const key = element.attributes.name;
        if (!key || names.has(key)) { throw new Error('Resource keys must be nonempty and unique.'); }
        names.add(key);
    }
    return root;
}
function resource(element: Element): Resource {
    return {
        key: element.attributes.name,
        value: element.children.find(child => child.name === 'value')?.text || '',
        comment: element.children.find(child => child.name === 'comment')?.text || '',
        editable: !element.attributes.type && !element.attributes.mimetype &&
            element.children.every(child => !child.children.length)
    };
}
export function readResources(xml: string): Resource[] {
    return parse(xml).children.filter(child => child.name === 'data').map(resource);
}
function escape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/\r/g, '&#13;');
}
function escapeAttribute(text: string): string {
    return escape(text).replace(/'/g, '&apos;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;');
}
export interface ResourceChange {
    key: string;
    field: 'value' | 'comment' | 'key' | 'delete';
    value: string;
}
export function changeResource(xml: string, change: ResourceChange): string {
    const root = parse(xml);
    const data = root.children.filter(child => child.name === 'data');
    const element = data.find(child => child.attributes.name === change.key);
    if (!change.key) { throw new Error('A resource key is required.'); }
    if (!element) {
        if (change.field === 'delete') { return xml; }
        const key = change.field === 'key' ? change.value : change.key;
        if (!key || data.some(child => child.attributes.name === key)) { throw new Error('A nonempty, unique resource key is required.'); }
        const newline = xml.includes('\r\n') ? '\r\n' : '\n';
        const value = change.field === 'value' ? change.value : '';
        const comment = change.field === 'comment' ? `<comment>${escape(change.value)}</comment>` : '';
        const entry = `  <data name="${escapeAttribute(key)}" xml:space="preserve"><value>${escape(value)}</value>${comment}</data>${newline}`;
        if (root.selfClosing) {
            return xml.slice(0, root.start) + xml.slice(root.start, root.end).replace(/\/\s*>$/, `>${newline}${entry}</root>`) + xml.slice(root.end);
        }
        return xml.slice(0, root.contentEnd) + entry + xml.slice(root.contentEnd);
    }
    if (!resource(element).editable) { throw new Error('Typed and binary resources cannot be edited in this table.'); }
    if (change.field === 'delete') { return xml.slice(0, element.start) + xml.slice(element.end); }
    if (change.field === 'key') {
        if (!change.value || data.some(child => child !== element && child.attributes.name === change.value)) {
            throw new Error('The new resource key must be nonempty and unique.');
        }
        const opening = xml.slice(element.start, element.contentStart).replace(/(\sname\s*=\s*)(["'])([\s\S]*?)\2/,
            (_match, prefix: string, quote: string) => `${prefix}${quote}${escapeAttribute(change.value)}${quote}`);
        return xml.slice(0, element.start) + opening + xml.slice(element.contentStart);
    }
    const child = element.children.find(item => item.name === change.field);
    if (child && child.text === change.value) { return xml; }
    const replacement = `<${change.field}>${escape(change.value)}</${change.field}>`;
    if (child) {
        if (child.selfClosing) {
            const opening = xml.slice(child.start, child.end).replace(/\/\s*>$/, `>${escape(change.value)}</${change.field}>`);
            return xml.slice(0, child.start) + opening + xml.slice(child.end);
        }
        return xml.slice(0, child.contentStart) + escape(change.value) + xml.slice(child.contentEnd);
    }
    if (element.selfClosing) {
        return xml.slice(0, element.start) + xml.slice(element.start, element.end).replace(/\/\s*>$/, `>${replacement}</data>`) + xml.slice(element.end);
    }
    return xml.slice(0, element.contentEnd) + replacement + xml.slice(element.contentEnd);
}

/** A language suffix starts with an ISO-style two/three-letter language code. */
export function resourceFamily(filename: string): string {
    return filename.replace(/\.[a-z]{2,3}(?:-[a-z0-9]{2,8})*(?=\.res[xw]$)/i, '');
}

/** Reorder complete data elements, preserving their contents and all other XML. */
export function sortResources(xml: string): string {
    const data = parse(xml).children.filter(child => child.name === 'data');
    const sorted = data.slice().sort((a, b) => a.attributes.name < b.attributes.name ? -1 : a.attributes.name > b.attributes.name ? 1 : 0);
    let result = xml;
    for (let index = data.length - 1; index >= 0; index--) {
        result = result.slice(0, data[index].start) + xml.slice(sorted[index].start, sorted[index].end) + result.slice(data[index].end);
    }
    return result;
}
