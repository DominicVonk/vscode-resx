import * as path from 'path';
import * as vscode from 'vscode';
import { getNonce } from './util';
import { changeResource, readResources, resourceFamily, ResourceChange } from './resources';

interface EditorChange extends ResourceChange { uri: string; }
function isChange(value: unknown): value is EditorChange {
    if (!value || typeof value !== 'object') { return false; }
    const message = value as { [key: string]: unknown };
    return typeof message.uri === 'string' && typeof message.key === 'string' &&
        typeof message.value === 'string' && ['key', 'value', 'comment', 'delete'].includes(String(message.field));
}

export class ResXEditorProvider implements vscode.CustomTextEditorProvider {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.window.registerCustomEditorProvider('resx.editor', new ResXEditorProvider(context));
    }
    constructor(private readonly context: vscode.ExtensionContext) { }

    public async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
        panel.webview.options = { enableScripts: true };
        panel.webview.html = this.getHtmlForWebview(panel.webview);
        const documents = new Map<string, vscode.TextDocument>();
        let disposed = false;
        let queue = Promise.resolve();
        const directory = path.posix.dirname(document.uri.path);
        const family = resourceFamily(path.posix.basename(document.uri.path));
        const report = (error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            panel.webview.postMessage({ type: 'error', message });
            vscode.window.showErrorMessage(`ResX Editor: ${message}`);
        };
        const update = () => {
            if (disposed) { return; }
            try {
                panel.webview.postMessage({ type: 'update', files: Array.from(documents.values()).map(file => ({
                    uri: file.uri.toString(), name: path.posix.basename(file.uri.path), resources: readResources(file.getText())
                })) });
            } catch (error) { report(error); }
        };
        const discover = async () => {
            const siblings = await vscode.workspace.fs.readDirectory(document.uri.with({ path: directory }));
            const uris = siblings.filter(([name, type]) => type === vscode.FileType.File && resourceFamily(name) === family)
                .map(([name]) => document.uri.with({ path: path.posix.join(directory, name) }));
            documents.clear();
            documents.set(document.uri.toString(), document);
            for (const uri of uris.sort((a, b) => a.path.localeCompare(b.path))) {
                if (uri.toString() !== document.uri.toString()) {
                    documents.set(uri.toString(), await vscode.workspace.openTextDocument(uri));
                }
            }
            update();
        };
        const subscription = vscode.workspace.onDidChangeTextDocument(event => {
            if (documents.has(event.document.uri.toString())) { documents.set(event.document.uri.toString(), event.document); update(); }
        });
        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(directory, '*'));
        const refresh = () => { queue = queue.then(discover).catch(report); };
        watcher.onDidCreate(refresh);
        watcher.onDidDelete(refresh);
        panel.onDidDispose(() => { disposed = true; subscription.dispose(); watcher.dispose(); });
        panel.webview.onDidReceiveMessage((message: unknown) => {
            if (message && typeof message === 'object' && 'type' in message && (message as { type: unknown }).type === 'xml') {
                vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
                return;
            }
            if (message && typeof message === 'object' && 'type' in message && (message as { type: unknown }).type === 'git') {
                vscode.commands.executeCommand('resx.openGitDiff', document.uri);
                return;
            }
            if (message && typeof message === 'object' && 'type' in message && (message as { type: unknown }).type === 'ready') { update(); return; }
            if (!isChange(message)) { return; }
            queue = queue.then(async () => {
                const target = documents.get(message.uri);
                if (!target) { throw new Error('This file is not part of the resource group.'); }
                const text = changeResource(target.getText(), message);
                if (text !== target.getText()) {
                    const edit = new vscode.WorkspaceEdit();
                    edit.replace(target.uri, new vscode.Range(0, 0, target.lineCount, 0), text);
                    if (!await vscode.workspace.applyEdit(edit)) { throw new Error('Could not apply the resource edit.'); }
                }
                update();
            }).catch(error => { report(error); update(); });
        });
        queue = discover().catch(report);
        await queue;
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const uri = (name: string) => webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'editor', name)));
        const nonce = getNonce();
        return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${uri('resx.css')}" rel="stylesheet"><title>ResX Editor</title></head>
        <body><p>Sibling language files are grouped automatically. Save each changed file, or use Save All.</p>
        <button id="git" type="button">Compare with Git HEAD</button><button id="xml" type="button">Open as XML</button><label>Search <input id="search" type="search" placeholder="Keys, values and comments"></label><p id="error" role="alert" hidden></p><table><thead></thead><tbody></tbody></table>
        <button id="add" type="button">+ Add resource</button>
        <script nonce="${nonce}" src="${uri('resx.js')}"></script></body></html>`;
    }
}
