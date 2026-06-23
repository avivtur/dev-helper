import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import { execFile } from 'child_process';

import type { StateService } from '../services/StateService.js';
import type { GitHubService } from '../services/GitHubService.js';
import type { JiraService } from '../services/JiraService.js';
import type { AgentActionType, JiraTicket, PrInfo, WebviewToExt } from '../types.js';
import {
  diffJiraLists,
  diffPrLists,
  diffReviewLists,
  formatRefreshToast,
} from '../utils/refreshDiff.js';
import {
  ACCESSIBILITY_HINT,
  ComposerAutomationService,
} from '../services/ComposerAutomationService.js';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly _skillDir: string,
    private readonly _workspaceDir: string,
    private readonly stateService: StateService,
    private readonly ghService: GitHubService,
    private readonly jiraService: JiraService | null,
    private readonly composerAutomation: ComposerAutomationService,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'out', 'webview-ui')),
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message: WebviewToExt) => this.handleMessage(message),
      undefined,
      this.context.subscriptions,
    );

    this.stateService.onChange((states) => {
      this.postMessage({ type: 'state', data: states });
    });
  }

  postMessage(message: unknown): void {
    this.view?.webview.postMessage(message);
  }

  postEnrichedYourPrs(prs: PrInfo[]): void {
    this.postMessage({ type: 'yourPrs', data: this.enrichPrsWithState(prs) });
  }

  private async handleMessage(message: WebviewToExt): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.sendAllData();
        break;

      case 'openUrl':
        vscode.env.openExternal(vscode.Uri.parse(message.url));
        break;

      case 'workOnTicket':
        await this.handleWorkOnTicket(message.ticket, message.mode);
        break;

      case 'reconcile':
        await this.handleReconcile();
        break;

      case 'agentAction':
        await this.handleAgentAction(message.action, message.prNumber);
        break;

      case 'refresh':
        await this.handleRefresh(message.source, message.assignedToMe);
        break;

      case 'copyToClipboard':
        await vscode.env.clipboard.writeText(message.text);
        vscode.window.showInformationMessage('Copied to clipboard — paste in Slack');
        break;
    }
  }

  private async handleWorkOnTicket(
    ticket: string,
    mode: 'start' | 'resume',
  ): Promise<void> {
    const prompt = mode === 'resume'
      ? `resume work on ${ticket}`
      : `work on ${ticket}`;
    const result = await this.composerAutomation.sendAndSubmit(prompt);

    switch (result) {
      case 'submitted':
        vscode.window.showInformationMessage(
          mode === 'resume'
            ? `Resuming work on ${ticket}`
            : `Started work on ${ticket}`,
        );
        break;
      case 'pasted_only':
        vscode.window.showInformationMessage(
          `Prompt ready for ${ticket} — press Enter to start.`,
        );
        if (os.platform() === 'darwin') {
          vscode.window.showWarningMessage(ACCESSIBILITY_HINT);
        }
        break;
      case 'failed':
        vscode.window.showErrorMessage(
          `Could not open agent chat for ${ticket}. Prompt copied to clipboard — paste manually.`,
        );
        break;
    }
  }

  private async handleAgentAction(
    action: AgentActionType,
    prNumber?: number,
  ): Promise<void> {
    let prompt: string;
    let label: string;

    switch (action) {
      case 'monitor-pr':
        prompt = `/personal-pr-monitor ${prNumber}`;
        label = `PR #${prNumber}`;
        break;
      case 'monitor-all':
        prompt = '/personal-pr-monitor';
        label = 'all PRs';
        break;
      case 'review-pr':
        prompt = `/personal-reviewer ${prNumber}`;
        label = `PR #${prNumber} review`;
        break;
    }

    const result = await this.composerAutomation.sendAndSubmit(prompt);

    switch (result) {
      case 'submitted':
        vscode.window.showInformationMessage(`Agent started: ${label}`);
        break;
      case 'pasted_only':
        vscode.window.showInformationMessage(`Prompt ready for ${label} — press Enter to start.`);
        if (os.platform() === 'darwin') {
          vscode.window.showWarningMessage(ACCESSIBILITY_HINT);
        }
        break;
      case 'failed':
        vscode.window.showErrorMessage(
          `Could not open agent chat for ${label}. Prompt copied to clipboard — paste manually.`,
        );
        break;
    }
  }

  private async handleReconcile(): Promise<void> {
    const reconcilePath = path.join(this._skillDir, 'scripts', 'reconcile.sh');
    const stateCliPath = path.join(this._skillDir, 'scripts', 'state-cli.sh');

    this.postMessage({ type: 'reconcileStatus', loading: true });

    try {
      const reconcileOutput = await this.execScript(reconcilePath, []);
      const waitingOutput = await this.execScript(stateCliPath, ['waiting']);

      const summary = [reconcileOutput, waitingOutput].filter(Boolean).join('\n\n');
      const isInSync = !summary
        || summary.includes('already in sync')
        || summary.includes('no changes');

      vscode.window.showInformationMessage(
        isInSync
          ? 'Reconcile — already in sync'
          : summary.slice(0, 300) || 'Reconcile complete.',
      );

      this.postMessage({ type: 'state', data: this.stateService.getAll() });
    } catch (e) {
      vscode.window.showErrorMessage(`Reconcile failed: ${(e as Error).message}`);
    } finally {
      this.postMessage({ type: 'reconcileStatus', loading: false });
    }
  }

  private execScript(script: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('bash', [script, ...args], { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  private async handleRefresh(source: 'prs' | 'jira' | 'all', assignedToMe?: boolean): Promise<void> {
    try {
      if (source === 'prs' || source === 'all') {
        const beforeYourPrs = this.ghService.getYourPrsCached();
        const beforeToReview = this.ghService.getPrsToReviewCached();

        this.postRefreshStatus('yourPrs', true);
        this.postRefreshStatus('prsToReview', true);

        const [yourPrs, toReview] = await Promise.all([
          this.ghService.fetchYourPrs(),
          this.ghService.fetchPrsToReview(),
        ]);

        const yourPrsChanges = diffPrLists(beforeYourPrs, yourPrs);
        const reviewChanges = diffReviewLists(beforeToReview, toReview);
        const yourPrsUpdated = this.ghService.getYourPrsLastUpdated();
        const toReviewUpdated = this.ghService.getPrsToReviewLastUpdated();

        this.postMessage({ type: 'yourPrs', data: this.enrichPrsWithState(yourPrs) });
        this.postMessage({ type: 'prsToReview', data: toReview });

        this.postRefreshStatus('yourPrs', false, yourPrsUpdated ?? undefined, yourPrsChanges);
        this.postRefreshStatus('prsToReview', false, toReviewUpdated ?? undefined, reviewChanges);

        vscode.window.showInformationMessage(formatRefreshToast('Your PRs', yourPrsChanges));
        vscode.window.showInformationMessage(formatRefreshToast('PRs to Review', reviewChanges));
      }

      if ((source === 'jira' || source === 'all') && this.jiraService) {
        const beforeJira = this.jiraService.getCached();

        this.postRefreshStatus('jiraBacklog', true);

        const backlog = await this.jiraService.fetchBacklog(assignedToMe ?? true);
        const jiraChanges = diffJiraLists(beforeJira, backlog);
        const jiraUpdated = this.jiraService.getLastUpdated();

        this.postMessage({ type: 'jiraBacklog', data: this.enrichJiraWithState(backlog) });
        this.postRefreshStatus('jiraBacklog', false, jiraUpdated ?? undefined, jiraChanges);

        vscode.window.showInformationMessage(formatRefreshToast('Jira backlog', jiraChanges));
      }
    } catch (e) {
      const msg = (e as Error).message;
      vscode.window.showErrorMessage(`Refresh failed: ${msg}`);
      this.postMessage({ type: 'error', source, message: msg });

      if (source === 'prs' || source === 'all') {
        this.postRefreshStatus('yourPrs', false);
        this.postRefreshStatus('prsToReview', false);
      }
      if ((source === 'jira' || source === 'all') && this.jiraService) {
        this.postRefreshStatus('jiraBacklog', false);
      }
    }
  }

  private postRefreshStatus(
    source: 'yourPrs' | 'prsToReview' | 'jiraBacklog',
    loading: boolean,
    lastUpdated?: string,
    changes?: string[],
  ): void {
    this.postMessage({
      type: 'refreshStatus',
      source,
      loading,
      lastUpdated,
      changes,
    });
  }

  postSectionTimestamps(): void {
    const yourPrsUpdated = this.ghService.getYourPrsLastUpdated();
    const toReviewUpdated = this.ghService.getPrsToReviewLastUpdated();

    if (yourPrsUpdated) {
      this.postRefreshStatus('yourPrs', false, yourPrsUpdated);
    }
    if (toReviewUpdated) {
      this.postRefreshStatus('prsToReview', false, toReviewUpdated);
    }
    if (this.jiraService) {
      const jiraUpdated = this.jiraService.getLastUpdated();
      if (jiraUpdated) {
        this.postRefreshStatus('jiraBacklog', false, jiraUpdated);
      }
    }
  }

  private enrichPrsWithState(prs: PrInfo[]): PrInfo[] {
    const states = this.stateService.getAll();
    return prs.map((pr) => {
      const match = states.find((s) => s.prNumber === pr.number);
      if (!match) return pr;
      return {
        ...pr,
        learnStatus: match.learn?.status ?? 'none',
        ticketKey: match.ticket,
        ticketPhase: match.phase,
        ticketWaitingSince: match.waiting?.active ? match.waiting.since : undefined,
      };
    });
  }

  private enrichJiraWithState(tickets: JiraTicket[]): (JiraTicket & { tracked: boolean })[] {
    const states = this.stateService.getAll();
    const trackedKeys = new Set(states.filter((s) => s.phase !== 'done').map((s) => s.ticket));
    return tickets.map((t) => ({ ...t, tracked: trackedKeys.has(t.key) }));
  }

  private sendAllData(): void {
    this.postMessage({ type: 'state', data: this.stateService.getAll() });
    this.postMessage({ type: 'yourPrs', data: this.enrichPrsWithState(this.ghService.getYourPrsCached()) });
    this.postMessage({ type: 'prsToReview', data: this.ghService.getPrsToReviewCached() });
    if (this.jiraService) {
      this.postMessage({ type: 'jiraBacklog', data: this.enrichJiraWithState(this.jiraService.getCached()) });
    }
    this.postSectionTimestamps();
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const distPath = path.join(this.context.extensionPath, 'out', 'webview-ui');

    const scriptUri = this.resolveAsset(webview, distPath, 'index.js');
    const styleUri = this.resolveAsset(webview, distPath, 'index.css');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             script-src 'nonce-${nonce}';
             style-src ${webview.cspSource} 'unsafe-inline';
             font-src ${webview.cspSource};">
  ${styleUri ? `<link rel="stylesheet" href="${styleUri}">` : ''}
  <title>Dev Helper</title>
</head>
<body>
  <div id="root"></div>
  ${scriptUri ? `<script nonce="${nonce}" src="${scriptUri}"></script>` : `<p style="padding:12px;color:var(--vscode-foreground)">Building webview... Run <code>npm run build</code> in the extension directory.</p>`}
</body>
</html>`;
  }

  private resolveAsset(
    webview: vscode.Webview,
    distPath: string,
    filename: string,
  ): vscode.Uri | null {
    const filePath = path.join(distPath, filename);
    if (fs.existsSync(filePath)) {
      return webview.asWebviewUri(vscode.Uri.file(filePath));
    }
    return null;
  }
}
