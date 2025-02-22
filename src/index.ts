#!/usr/bin/env node

import { Command } from 'commander';
import { createConnectCommand } from './commands/connect';
import { createWorkspaceCommand } from './commands/workspace';
import { createDbCommand } from './commands/db';
import { createTenantsCommand } from './commands/tenants';
import { configCommand } from './commands/config';
import { createUsersCommand } from './commands/user';
import { createLocalCommand } from './commands/local';
import { addGlobalOptions, updateChalkConfig } from './lib/globalOptions';

const cli = new Command()
  .version('0.1.0')
  .description('Nile CLI')
  .addHelpText('after', `
Examples:
  $ nile connect                   Connect to Nile
  $ nile --no-color db show my-database
  $ nile tenants list             List tenants in selected database
  $ nile config --api-key <key>   Set API key in config
  $ nile users create             Create a new user
  $ nile local start              Start local development environment
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
cli.addCommand(configCommand());
cli.addCommand(createUsersCommand(() => cli.opts()));
cli.addCommand(createLocalCommand(() => cli.opts()));

cli.parse(process.argv); 