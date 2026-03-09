import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function initLogger(): vscode.OutputChannel {
  channel = vscode.window.createOutputChannel('Claude Worktree Sync');
  channel.show(true); // 디버깅 중 자동으로 출력 패널 표시
  log('Logger initialized');
  return channel;
}

export function log(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  channel?.appendLine(line);
  console.log(`[ClaudeWT] ${line}`);
}

export function getChannel(): vscode.OutputChannel | undefined {
  return channel;
}
