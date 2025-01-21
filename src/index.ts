#!/usr/bin/env node

import { Command } from 'commander';
import { createConnectCommand } from './commands/connect';
import { createWorkspaceCommand } from './commands/workspace';
import { createDbCommand } from './commands/db';
import { createTenantsCommand } from './commands/tenants';
import { addGlobalOptions, updateChalkConfig } from './lib/globalOptions';

const cli = new Command()
  .version('0.1.0')
  .description('Nile CLI')
  .addHelpText('after', `
Examples:
  $ nile connect                   Connect to Nile
  $ nile --no-color db show my-database
  $ nile tenants list             List tenants in selected database
`);

// Add global options
addGlobalOptions(cli);

// Configure color settings
cli.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();
  updateChalkConfig(opts.color);
});

// Register commands
cli.addCommand(createConnectCommand(() => cli.opts()));
cli.addCommand(createWorkspaceCommand(() => cli.opts()));
cli.addCommand(createDbCommand(() => cli.opts()));
cli.addCommand(createTenantsCommand(() => cli.opts()));

cli.parse(process.argv); 