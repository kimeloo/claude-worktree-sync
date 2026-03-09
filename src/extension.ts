import * as vscode from 'vscode';
import { ConfigManager } from './config';
import { SyncEngine } from './syncEngine';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = new ConfigManager();
  const engine = new SyncEngine(config);

  context.subscriptions.push(config, engine);

  await engine.initialize();
}

export function deactivate(): void {
  // Disposables are cleaned up by VSCode via context.subscriptions
}
