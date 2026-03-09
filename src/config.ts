import * as vscode from 'vscode';

const SECTION = 'claudeWorktreeSync';

export interface SyncConfig {
  autoAdd: boolean;
  autoRemove: boolean;
  pollingInterval: number;
}

export class ConfigManager implements vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<SyncConfig>();
  readonly onDidChange = this._onDidChange.event;
  private disposable: vscode.Disposable;

  constructor() {
    this.disposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(SECTION)) {
        this._onDidChange.fire(this.get());
      }
    });
  }

  get(): SyncConfig {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    return {
      autoAdd: cfg.get<boolean>('autoAdd', true),
      autoRemove: cfg.get<boolean>('autoRemove', true),
      pollingInterval: cfg.get<number>('pollingInterval', 5000),
    };
  }

  dispose(): void {
    this._onDidChange.dispose();
    this.disposable.dispose();
  }
}
