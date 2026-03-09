import * as vscode from 'vscode';
import { ConfigManager } from './config';
import { SyncEngine } from './syncEngine';
import { initLogger, log } from './logger';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const channel = initLogger();
  log('=== Extension activating ===');
  log(`Workspace folders: ${JSON.stringify(
    (vscode.workspace.workspaceFolders ?? []).map(f => ({
      name: f.name,
      uri: f.uri.fsPath,
      index: f.index,
    }))
  )}`);

  const config = new ConfigManager();
  log(`Config: ${JSON.stringify(config.get())}`);

  const engine = new SyncEngine(config, context);

  context.subscriptions.push(channel, config, engine);

  try {
    await engine.initialize();
    log('=== Extension activated successfully ===');
  } catch (err) {
    log(`!!! Extension activation FAILED: ${err}`);
    throw err;
  }
}

export function deactivate(): void {
  // Disposables are cleaned up by VSCode via context.subscriptions
}
