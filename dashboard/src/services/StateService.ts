import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import type { TicketState } from '../types.js';

export class StateService {
  private readonly stateDir: string;
  private readonly watcher: vscode.FileSystemWatcher;
  private readonly onChangeEmitter = new vscode.EventEmitter<TicketState[]>();
  readonly onChange = this.onChangeEmitter.event;

  constructor(skillDir: string) {
    this.stateDir = path.join(skillDir, 'state');

    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.stateDir, '*/state.json'),
    );
    this.watcher.onDidChange(() => this.emitCurrent());
    this.watcher.onDidCreate(() => this.emitCurrent());
    this.watcher.onDidDelete(() => this.emitCurrent());
  }

  getAll(): TicketState[] {
    if (!fs.existsSync(this.stateDir)) {
      return [];
    }

    const entries = fs.readdirSync(this.stateDir, { withFileTypes: true });
    const states: TicketState[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const stateFile = path.join(this.stateDir, entry.name, 'state.json');
      try {
        const raw = fs.readFileSync(stateFile, 'utf8');
        states.push(JSON.parse(raw) as TicketState);
      } catch {
        // Skip missing or malformed files
      }
    }

    return states;
  }

  getActive(): TicketState[] {
    return this.getAll().filter((s) => s.phase !== 'done');
  }

  getTicketsWorkedSince(since: Date): { ticket: string; phases: string[] }[] {
    const result: { ticket: string; phases: string[] }[] = [];
    const sinceIso = since.toISOString();

    for (const state of this.getAll()) {
      const recentPhases = (state.history ?? [])
        .filter((h) => h.at >= sinceIso)
        .map((h) => h.phase);

      if (recentPhases.length > 0) {
        result.push({ ticket: state.ticket, phases: recentPhases });
      }
    }

    return result;
  }

  getTicketsCompletedSince(since: Date): string[] {
    const sinceIso = since.toISOString();
    return this.getAll()
      .filter((s) => s.phase === 'done')
      .filter((s) => (s.history ?? []).some((h) => h.phase === 'done' && h.at >= sinceIso))
      .map((s) => s.ticket);
  }

  dispose(): void {
    this.watcher.dispose();
    this.onChangeEmitter.dispose();
  }

  private emitCurrent(): void {
    this.onChangeEmitter.fire(this.getAll());
  }
}
