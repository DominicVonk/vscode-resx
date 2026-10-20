import * as assert from 'assert';
import * as vscode from 'vscode';
import { readGitResource, targetUri } from '../../ResourceDiffProvider';
import { readResources } from '../../resources';

suite('ResX extension integration', () => {
    test('activates commands and reads committed Git resources', async () => {
        const extension = vscode.extensions.getExtension('DominicVonk.vscode-resx-editor');
        assert.ok(extension);
        await extension!.activate();
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('resx.openGitDiff'));
        const folder = vscode.workspace.workspaceFolders![0].uri;
        const uri = folder.with({ path: folder.path + '/Resources.resx' });
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        await gitExtension!.activate();
        // Trigger discovery before invoking the command, as VS Code does during normal workspace startup.
        await vscode.commands.executeCommand('git.openRepository', folder.fsPath);
        const result = await readGitResource(uri);
        assert.strictEqual(readResources(result.before)[0].value, 'committed');
        assert.strictEqual(result.relative, 'Resources.resx');
        assert.strictEqual(targetUri({ resourceUri: uri })!.toString(), uri.toString());
        const untracked = await readGitResource(folder.with({ path: folder.path + '/New.resx' }));
        assert.deepStrictEqual(readResources(untracked.before), []);
    });

    test('sorts on save and opens grouped editor and Git comparison', async () => {
        const folder = vscode.workspace.workspaceFolders![0].uri;
        const uri = folder.with({ path: folder.path + '/Resources.resx' });
        await vscode.workspace.getConfiguration('resx', uri).update('sortOnSave', true, vscode.ConfigurationTarget.Workspace);
        const document = await vscode.workspace.openTextDocument(uri);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), '<root><data name="Z"><value>z</value></data><data name="A"><value>  a\nline  </value></data></root>');
        assert.ok(await vscode.workspace.applyEdit(edit));
        assert.ok(await document.save());
        assert.deepStrictEqual(readResources(document.getText()).map(resource => resource.key), ['A', 'Z']);
        assert.strictEqual(readResources(document.getText())[0].value, '  a\nline  ');
        await vscode.commands.executeCommand('vscode.openWith', uri, 'resx.editor');
        assert.ok(vscode.workspace.textDocuments.some(file => file.uri.path.endsWith('/Resources.nl.resx')));
        await vscode.commands.executeCommand('resx.openGitDiff', { resourceUri: uri });
        await vscode.commands.executeCommand('resx.openXml', uri);
        assert.strictEqual(vscode.window.activeTextEditor!.document.uri.toString(), uri.toString());
    });
});
