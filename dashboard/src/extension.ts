import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { DashboardViewProvider } from './providers/DashboardViewProvider.js';
import { StateService } from './services/StateService.js';
import { JiraService } from './services/JiraService.js';
import { GitHubService } from './services/GitHubService.js';
import { Poller } from './services/Poller.js';
import { parseJiraCreds } from './services/CredParser.js';
import { ComposerAutomationService } from './services/ComposerAutomationService.js';
import type { SetupCheck } from './types.js';

const SKILL_DIR_RELATIVE = '.cursor/skills/dev-helper';
const PR_POLL_MS = 5 * 60 * 1000;
const JIRA_POLL_MS = 10 * 60 * 1000;
const RECONCILE_POLL_MS = 30 * 60 * 1000;

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    return;
  }

  const workspaceDir = workspaceFolders[0].uri.fsPath;
  const skillDir = path.join(workspaceDir, SKILL_DIR_RELATIVE);

  const configPath = path.join(skillDir, 'dev-helper.config.json');
  const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {};

  const stateService = new StateService(skillDir);
  const ghService = new GitHubService(config);

  const creds = parseJiraCreds();
  const jiraService = creds ? new JiraService(creds, config) : null;
  const composerAutomation = new ComposerAutomationService();

  const provider = new DashboardViewProvider(
    context,
    skillDir,
    workspaceDir,
    stateService,
    ghService,
    jiraService,
    composerAutomation,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('devHelper.dashboard', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('devHelper.discoverComposerCommands', () =>
      ComposerAutomationService.discoverComposerCommands(),
    ),
    vscode.commands.registerCommand('devHelper.checkAccessibility', () =>
      ComposerAutomationService.checkAccessibility(),
    ),
    composerAutomation,
  );

  const poller = new Poller();

  poller.addTask('github-prs', async () => {
    const [yourPrs, toReview] = await Promise.all([
      ghService.fetchYourPrs(),
      ghService.fetchPrsToReview(),
    ]);
    provider.postEnrichedYourPrs(yourPrs);
    provider.postMessage({ type: 'prsToReview', data: toReview });
    provider.postSectionTimestamps();
  }, PR_POLL_MS);

  if (jiraService) {
    poller.addTask('jira-backlog', async () => {
      const backlog = await jiraService.fetchBacklog();
      provider.postMessage({ type: 'jiraBacklog', data: backlog });
      provider.postSectionTimestamps();
    }, JIRA_POLL_MS);
  }

  const reconcilePath = path.join(skillDir, 'scripts', 'reconcile.sh');
  poller.addTask('reconcile', async () => {
    try {
      const { execFile } = await import('child_process');
      await new Promise<void>((resolve, reject) => {
        execFile('bash', [reconcilePath], { timeout: 30000 }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      provider.postMessage({ type: 'state', data: stateService.getAll() });
    } catch {
      // Reconcile failures are non-critical; silently continue
    }
  }, RECONCILE_POLL_MS);

  poller.start();

  context.subscriptions.push(
    new vscode.Disposable(() => {
      stateService.dispose();
      poller.dispose();
    }),
  );

  registerMcpServer(context, skillDir, workspaceDir);

  runSetupChecks(workspaceDir, skillDir, configPath, creds !== null)
    .then((checks) => provider.postMessage({ type: 'setupStatus', checks }))
    .catch(() => { /* setup check failures are non-critical */ });
}

async function runSetupChecks(
  workspaceDir: string,
  skillDir: string,
  configPath: string,
  jiraCredsValid: boolean,
): Promise<SetupCheck[]> {
  const { execFile } = await import('child_process');

  const exec = (cmd: string, args: string[]): Promise<boolean> =>
    new Promise((resolve) => {
      execFile(cmd, args, { timeout: 5000, cwd: workspaceDir }, (err) => resolve(!err));
    });

  const configExists = fs.existsSync(configPath);
  const ghAuthed = await exec('gh', ['auth', 'status']);

  const remoteOutput = await new Promise<string>((resolve) => {
    execFile('git', ['remote'], { timeout: 5000, cwd: workspaceDir }, (_err, stdout) => {
      resolve(stdout?.trim() ?? '');
    });
  });
  const remotes = remoteOutput.split('\n').map((r) => r.trim());
  const remotesOk = remotes.includes('origin') && remotes.includes('upstream');

  const hooksDir = path.join(workspaceDir, '.cursor', 'hooks');
  const hooksInstalled = fs.existsSync(path.join(hooksDir, 'personal-dev-helper-state.sh'));

  return [
    { id: 'config', label: 'Configuration file', passed: configExists, setupRef: 'Section 2: Configuration File' },
    { id: 'jira-creds', label: 'Jira credentials', passed: jiraCredsValid, setupRef: 'Section 1: Jira API Credentials' },
    { id: 'gh-cli', label: 'GitHub CLI authenticated', passed: ghAuthed, setupRef: 'Prerequisites: gh auth login' },
    { id: 'git-remotes', label: 'Git remotes (origin + upstream)', passed: remotesOk, setupRef: 'Prerequisites: Git Remotes' },
    { id: 'hooks', label: 'Cursor hooks installed', passed: hooksInstalled, setupRef: 'Section 3: Cursor Hooks' },
  ];
}

function registerMcpServer(
  context: vscode.ExtensionContext,
  skillDir: string,
  workspaceDir: string,
): void {
  const cursor = (vscode as Record<string, unknown>).cursor as
    | { mcp?: { registerServer: (config: unknown) => void; unregisterServer: (name: string) => void } }
    | undefined;

  if (cursor?.mcp?.registerServer) {
    const serverPath = context.asAbsolutePath(path.join('out', 'mcp', 'server.js'));
    cursor.mcp.registerServer({
      name: 'dev-helper',
      server: {
        command: 'node',
        args: [serverPath],
        env: { SKILL_DIR: skillDir, WORKSPACE_DIR: workspaceDir },
      },
    });

    context.subscriptions.push(
      new vscode.Disposable(() => cursor.mcp?.unregisterServer('dev-helper')),
    );
  }
}

export function deactivate(): void {
  // Cleanup handled by disposables
}
