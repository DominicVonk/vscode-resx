import * as vscode from 'vscode';
import { ResXEditorProvider } from './ResXEditorProvider';
import { openResourceDiff, ResourceTarget, targetUri } from './ResourceDiffProvider';
import { sortResources } from './resources';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(ResXEditorProvider.register(context));
    context.subscriptions.push(vscode.commands.registerCommand('resx.openGitDiff', async (uri?: ResourceTarget) => {
        try { await openResourceDiff(context, uri); }
        catch (error) { vscode.window.showErrorMessage(`ResX diff: ${error instanceof Error ? error.message : String(error)}`); }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('resx.openXml', async (uri?: ResourceTarget) => {
        const target = targetUri(uri);
        if (target) { await vscode.commands.executeCommand('vscode.openWith', target, 'default'); }
    }));
    context.subscriptions.push(vscode.workspace.onWillSaveTextDocument(event => {
        if (!/\.res[xw]$/i.test(event.document.uri.path) ||
            !vscode.workspace.getConfiguration('resx', event.document.uri).get<boolean>('sortOnSave', false)) { return; }
        try {
            const source = event.document.getText();
            const sorted = sortResources(source);
            if (source !== sorted) {
                event.waitUntil(Promise.resolve([vscode.TextEdit.replace(new vscode.Range(0, 0, event.document.lineCount, 0), sorted)]));
            }
        } catch (error) {
            vscode.window.showErrorMessage(`ResX sorting failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
}
export function deactivate() { }
