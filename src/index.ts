#!/usr/bin/env node

import { Command } from 'commander';
import { createConnectCommand } from './commands/connect';
import { createWorkspaceCommand } from './commands/workspace';
import { createDbCommand } from './commands/db';

const program = new Command();

program
  .name('nile')
  .description('Command line interface for Nile databases')
  .version('1.0.0');

program.addCommand(createConnectCommand());
program.addCommand(createWorkspaceCommand());
program.addCommand(createDbCommand());

program.parse(process.argv); 