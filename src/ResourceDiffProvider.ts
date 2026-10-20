import * as vscode from 'vscode';
import * as path from 'path';
import { diffResources } from './diff';
import { getNonce } from './util';

interface GitRepository {
    rootUri: vscode.Uri;
    show(ref: string, path: string): Promise<string>;
    getObjectDetails(ref: string, path: string): Promise<{ mode: string; object: string; size: number }>;
    state: { HEAD?: { commit?: string } };
}
interface GitExtension { getAPI(version: 1): { repositories: GitRepository[] }; }
export type ResourceTarget = vscode.Uri | { resourceUri: vscode.Uri };
export function targetUri(target?: ResourceTarget): vscode.Uri | undefined {
    return target instanceof vscode.Uri ? target : target?.resourceUri || vscode.window.activeTextEditor?.document.uri;
}
export async function readGitResource(target: vscode.Uri): Promise<{ before: string; commit?: string; relative: string }> {
    if (!target || !/\.res[xw]$/i.test(target.path) || target.scheme !== 'file') {
        throw new Error('Select a local .resx or .resw file to compare with Git HEAD.');
    }
    const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!extension) { throw new Error('The VS Code Git extension is unavailable.'); }
    const git = await extension.activate();
    const repository = git.getAPI(1).repositories.filter(repo => {
        const relative = path.relative(repo.rootUri.fsPath, target.fsPath);
        return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    }).sort((a, b) => b.rootUri.fsPath.length - a.rootUri.fsPath.length)[0];
    if (!repository) { throw new Error('This resource file is not inside an open Git repository.'); }
    const commit = repository.state.HEAD?.commit;
    const relative = path.relative(repository.rootUri.fsPath, target.fsPath).split(path.sep).join('/');
    // Check existence explicitly so a failed Git read is never mistaken for an empty file.
    let exists = false;
    if (commit) {
        try { await repository.getObjectDetails(commit, relative); exists = true; }
        catch (error) {
            if (!error || typeof error !== 'object' || !('gitErrorCode' in error) ||
                (error as { gitErrorCode: unknown }).gitErrorCode !== 'UnknownPath') { throw error; }
        }
    }
    const before = exists && commit ? await repository.show(commit, target.fsPath) : '<root></root>';
    return { before, commit, relative };
}
export async function openResourceDiff(context: vscode.ExtensionContext, input?: ResourceTarget): Promise<vscode.WebviewPanel> {
    const target = targetUri(input);
    if (!target) { throw new Error('Select a resource file to compare.'); }
    const { before, commit, relative } = await readGitResource(target);
    let document = await vscode.workspace.openTextDocument(target);
    const panel = vscode.window.createWebviewPanel('resx.diff', `ResX Changes: ${path.basename(target.fsPath)}`, vscode.ViewColumn.Active,
        { enableScripts: true });
    const nonce = getNonce();
    const asset = (name: string) => panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'editor', name)));
    panel.webview.html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}';">
        <link rel="stylesheet" href="${asset('diff.css')}"><title>ResX Changes</title></head><body>
        <h1>Changes against Git HEAD</h1><p id="revision"></p>
        <label>Search <input id="search" type="search"></label>
        <label><input id="unchanged" type="checkbox"> Show unchanged entries</label>
        <button id="xml">Open XML Diff</button><p id="summary" role="status"></p><p id="error" role="alert"></p>
        <table><thead><tr><th>Key / status</th><th>HEAD</th><th>Working file</th></tr></thead><tbody></tbody></table>
        <script nonce="${nonce}" src="${asset('diff.js')}"></script></body></html>`;
    const update = () => {
        try {
            panel.webview.postMessage({ type: 'diff', entries: diffResources(before, document.getText()),
                revision: `${relative} · ${commit ? commit.slice(0, 8) : 'No commits yet'} → working file (including unsaved changes)` });
        } catch (error) {
            panel.webview.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
        }
    };
    const textProvider = vscode.workspace.registerTextDocumentContentProvider(`resx-head-${nonce.toLowerCase()}`, {
        provideTextDocumentContent: () => before
    });
    panel.webview.onDidReceiveMessage(message => {
        if (message.type === 'ready') { update(); }
        if (message.type === 'xml') {
            const oldUri = vscode.Uri.parse(`resx-head-${nonce.toLowerCase()}:/${path.basename(target.path)}`);
            vscode.commands.executeCommand('vscode.diff', oldUri, target, `HEAD ↔ ${path.basename(target.path)}`, { preview: true });
        }
    });
    const subscription = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.uri.toString() === target.toString()) { document = event.document; update(); }
    });
    panel.onDidDispose(() => { subscription.dispose(); textProvider.dispose(); });
    return panel;
}
