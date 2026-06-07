import * as vscode from 'vscode';

type PollTask = {
  name: string;
  fn: () => Promise<void>;
  intervalMs: number;
};

export class Poller {
  private timers: NodeJS.Timeout[] = [];
  private tasks: PollTask[] = [];

  addTask(name: string, fn: () => Promise<void>, intervalMs: number): void {
    this.tasks.push({ name, fn, intervalMs });
  }

  start(): void {
    for (const task of this.tasks) {
      task.fn().catch((e) => {
        vscode.window.showWarningMessage(`Poller ${task.name}: ${(e as Error).message}`);
      });

      const timer = setInterval(() => {
        task.fn().catch((e) => {
          console.error(`Poller ${task.name}:`, e);
        });
      }, task.intervalMs);

      this.timers.push(timer);
    }
  }

  dispose(): void {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
  }
}
