import { execFile } from 'child_process';
import * as os from 'os';
import { promisify } from 'util';

import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

const DEFAULT_DELAY_MOUNT = 250;
const DEFAULT_DELAY_FOCUS = 120;
const DEFAULT_DELAY_SYNC = 150;
const CLIPBOARD_RESTORE_MS = 1000;

const ACCESSIBILITY_HINT =
  'Cursor needs Accessibility permission to auto-submit agent prompts. ' +
  'Open System Settings > Privacy & Security > Accessibility and enable Cursor.';

export type SubmitResult = 'submitted' | 'pasted_only' | 'failed';

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class ComposerAutomationService implements vscode.Disposable {
  private readonly outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Dev Helper');
  }

  dispose(): void {
    this.outputChannel.dispose();
  }

  log(message: string): void {
    this.outputChannel.appendLine(message);
  }

  private getDelays(): { focus: number; mount: number; sync: number } {
    const config = vscode.workspace.getConfiguration('devHelper');
    return {
      focus: config.get<number>('submitDelayFocus', DEFAULT_DELAY_FOCUS),
      mount: config.get<number>('submitDelayMount', DEFAULT_DELAY_MOUNT),
      sync: config.get<number>('submitDelaySync', DEFAULT_DELAY_SYNC),
    };
  }

  async sendAndSubmit(prompt: string): Promise<SubmitResult> {
    const originalClipboard = await vscode.env.clipboard.readText();
    const { focus, mount, sync } = this.getDelays();
    let pasted = false;
    let result: SubmitResult = 'failed';

    try {
      await vscode.env.clipboard.writeText(prompt);
      this.log(`Staging prompt: ${prompt}`);

      await vscode.commands.executeCommand('composer.newAgentChat');
      this.log('Opened new agent chat');
      await delay(mount);

      await vscode.commands.executeCommand('composer.focusComposer');
      this.log('Focused composer input');
      await delay(focus);

      await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
      pasted = true;
      this.log('Pasted prompt into composer');
      await delay(sync);

      if (os.platform() !== 'darwin') {
        this.log('Auto-submit skipped: macOS AppleScript required');
        result = 'pasted_only';
        return result;
      }

      await this.executeMacOSEnterSimulation();
      this.log('Submitted prompt via Return key simulation');
      result = 'submitted';
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown failure';
      this.log(`Automation error: ${message}`);

      if (pasted) {
        result = 'pasted_only';
        return result;
      }

      result = 'failed';
      return result;
    } finally {
      setTimeout(async () => {
        try {
          if (result === 'failed') {
            await vscode.env.clipboard.writeText(prompt);
          } else {
            await vscode.env.clipboard.writeText(originalClipboard);
          }
        } catch (restoreError) {
          this.log(
            `Failed to restore clipboard: ${
              restoreError instanceof Error ? restoreError.message : 'Unknown error'
            }`,
          );
        }
      }, CLIPBOARD_RESTORE_MS);
    }
  }

  private async executeMacOSEnterSimulation(): Promise<void> {
    const script = [
      'tell application "System Events"',
      '  if exists process "Cursor" then',
      '    tell process "Cursor"',
      '      set frontmost to true',
      '      key code 36',
      '    end tell',
      '  else',
      '    error "Cursor process not found"',
      '  end if',
      'end tell',
    ].join('\n');

    try {
      await execFileAsync('osascript', ['-e', script]);
    } catch {
      throw new Error(ACCESSIBILITY_HINT);
    }
  }

  static async checkAccessibility(): Promise<boolean> {
    if (os.platform() !== 'darwin') {
      vscode.window.showInformationMessage('Accessibility check is only available on macOS.');
      return false;
    }

    const probeScript = 'tell application "System Events" to return name of first process';

    try {
      await execFileAsync('osascript', ['-e', probeScript]);
      vscode.window.showInformationMessage(
        'Accessibility OK — Dev Helper can simulate Return for auto-submit.',
      );
      return true;
    } catch {
      vscode.window.showWarningMessage(ACCESSIBILITY_HINT);
      return false;
    }
  }

  static async discoverComposerCommands(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel('Dev Helper');
    const allCommands = await vscode.commands.getCommands(true);
    const patterns = ['composer', 'cursor.', 'chat', 'agent', 'aipopup', 'generation', 'submit'];
    const matched = allCommands
      .filter((command) =>
        patterns.some((pattern) => command.includes(pattern)),
      )
      .sort();

    outputChannel.clear();
    outputChannel.appendLine('Dev Helper — Composer command discovery');
    outputChannel.appendLine(`Platform: ${os.platform()}`);
    outputChannel.appendLine(`Matched commands (${matched.length}):`);
    matched.forEach((command) => outputChannel.appendLine(`  ${command}`));

    const required = ['composer.newAgentChat', 'composer.focusComposer'];
    required.forEach((command) => {
      const exists = allCommands.includes(command);
      outputChannel.appendLine(`${exists ? 'OK' : 'MISSING'}: ${command}`);
    });

    outputChannel.show(true);

    try {
      const { stdout } = await execFileAsync('agent', ['about'], { timeout: 10000 });
      outputChannel.appendLine('');
      outputChannel.appendLine('Cursor CLI (agent about):');
      outputChannel.appendLine(stdout.trim());
    } catch {
      outputChannel.appendLine('');
      outputChannel.appendLine('Cursor CLI (agent about): not available');
    }
  }
}

export { ACCESSIBILITY_HINT };
