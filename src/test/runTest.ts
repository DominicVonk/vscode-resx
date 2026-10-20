import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFileSync } from 'child_process';

import { runTests } from 'vscode-test';

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		// Download VS Code, unzip it and run the integration test
		const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'resx-extension-test-'));
        fs.writeFileSync(path.join(fixture, 'Resources.resx'), '<root><data name="Key"><value>committed</value></data></root>');
        fs.writeFileSync(path.join(fixture, 'Resources.nl.resx'), '<root><data name="Key"><value>vertaald</value></data></root>');
        const git = (args: string[]) => execFileSync('git', args, { cwd: fixture });
        git(['init']);
        git(['add', '.']);
        git(['-c', 'user.name=ResX Tests', '-c', 'user.email=resx-tests@example.invalid', 'commit', '-m', 'Test resource baseline']);
        fs.writeFileSync(path.join(fixture, 'New.resx'), '<root/>');
        await runTests({ extensionDevelopmentPath, extensionTestsPath, version: '1.95.3',
            launchArgs: [fixture, '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes',
                '--user-data-dir=' + path.join(fixture, '.vscode-user')] });
	} catch (err) {
		console.error('Failed to run tests', err);
		process.exit(1);
	}
}

main();
