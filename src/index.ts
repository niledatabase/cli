#!/usr/bin/env node

import { program } from 'commander';
import { createWorkspaceCommand } from './commands/workspace';
import { createAuthCommand } from './commands/auth';
import { createDbCommand } from './commands/db';
import { AuthOptions } from './lib/authUtils';
import chalk from 'chalk';

interface GlobalOptions extends AuthOptions {
  format?: 'human' | 'json' | 'csv';
  color?: boolean;
  debug?: boolean;
}

// Store the global options
let globalOptions: GlobalOptions = {
  color: true,  // Default to true
};

// Configure chalk based on color option
const updateChalkConfig = (color: boolean) => {
  if (color === false) {
    chalk.level = 0;
  }
};

program
  .name('nile')
  .description('Command line interface for Nile databases')
  .version('1.0.0')
  .option('--api-key <key>', 'API key for authentication (can also be set via NILE_API_KEY env variable)')
  .option('-f, --format <type>', 'Output format: human (default), json, or csv', 'human')
  .option('--color [boolean]', 'Enable colored output', true)
  .option('--no-color', 'Disable colored output for automation/CI pipelines')
  .option('--debug', 'Enable debug output')
  .addHelpText('after', `
Commands:
  auth               Authenticate with Nile
  workspace          Manage workspaces
  db                Manage Nile databases

Examples:
  $ nile auth connect                   Connect to Nile
  $ nile --api-key <key> workspace list
  $ nile --format json db list
  $ nile --no-color db show my-database`)
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    globalOptions = {
      apiKey: opts.apiKey,
      format: opts.format,
      color: opts.color,
      debug: opts.debug
    };
    updateChalkConfig(opts.color);
  });

// Function to get the latest options
const getGlobalOptions = () => globalOptions;

// Register commands
program.addCommand(createAuthCommand(getGlobalOptions));
program.addCommand(createWorkspaceCommand(getGlobalOptions));
program.addCommand(createDbCommand(getGlobalOptions));

program.parse(); 