import { Command } from 'commander';
import chalk from 'chalk';

export interface GlobalOptions {
  apiKey?: string;
  format?: 'human' | 'json' | 'csv';
  color?: boolean;
  debug?: boolean;
  dbHost?: string;
  globalHost?: string;
  workspace?: string;
  db?: string;
}

// Configure chalk based on color option
export function updateChalkConfig(color: boolean) {
  if (color === false) {
    chalk.level = 0;
  }
}

// Add global options to any command
export function addGlobalOptions(program: Command): Command {
  return program
    .option('--api-key <key>', 'API key for authentication')
    .option('--format <type>', 'Output format: human (default), json, or csv')
    .option('--color [boolean]', 'Enable/disable colored output')
    .option('--debug', 'Enable debug output')
    .option('--db-host <host>', 'Override database host domain (default: db.thenile.dev)')
    .option('--global-host <host>', 'Override global control plane host (default: global.thenile.dev)')
    .option('--workspace <n>', 'Workspace name (overrides selected workspace)')
    .option('--db <n>', 'Database name (overrides selected database)');
}

// Extract global options from command
export function getGlobalOptions(cmd: Command): GlobalOptions {
  const opts = cmd.opts();
  return {
    apiKey: opts.apiKey,
    format: opts.format,
    color: opts.color,
    debug: opts.debug,
    dbHost: opts.dbHost,
    globalHost: opts.globalHost,
    workspace: opts.workspace,
    db: opts.db
  };
}

export function getGlobalOptionsHelp(): string {
  return `Global Options:
  --api-key <key>        API key for authentication
  --global-host <host>   Override global control plane host (default: global.thenile.dev)
  --db-host <host>       Override database host domain (default: db.thenile.dev)
  --workspace <name>     Workspace name (overrides selected workspace)
  --db <name>           Database name (overrides selected database)
  --format <type>        Output format: human (default), json, csv
  --color [boolean]      Enable/disable colored output
  --debug               Enable debug output`;
} 