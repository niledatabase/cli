import { Command } from 'commander';
import { Config } from '../lib/config';
import { NileAPI } from '../lib/api';
import { getAuthToken } from '../lib/authUtils';
import { theme, table, formatCommand } from '../lib/colors';
import { GlobalOptions, getGlobalOptionsHelp } from '../lib/globalOptions';
import chalk from 'chalk';
import axios from 'axios';

interface Workspace {
  name: string;
  slug: string;
  id?: string;
  created?: string;
}

type GetOptions = () => GlobalOptions;

export function createWorkspaceCommand(getOptions: GetOptions): Command {
  const workspace = new Command('workspace')
    .description('Manage workspaces')
    .addHelpText('after', `
Examples:
  ${formatCommand('nile workspace list')}                List all workspaces
  ${formatCommand('nile workspace select demo')}         Select a workspace to use
  ${formatCommand('nile workspace show')}                Show current workspace
  ${formatCommand('nile workspace list', '--format json')}  List workspaces in JSON format

${getGlobalOptionsHelp()}`);

  workspace
    .command('list')
    .description('List all available workspaces')
    .action(async () => {
      try {
        const options = getOptions();
        const token = await getAuthToken(options);
        const api = new NileAPI({
          token,
          debug: options.debug,
          controlPlaneUrl: options.globalHost,
          dbHost: options.dbHost
        });
        const workspaces = await api.listWorkspaces();

        if (options.format === 'json') {
          console.log(JSON.stringify(workspaces, null, 2));
          return;
        }

        if (options.format === 'csv') {
          console.log('NAME,SLUG');
          workspaces.forEach(w => {
            console.log(`${w.name},${w.slug}`);
          });
          return;
        }

        if (workspaces.length === 0) {
          console.log(theme.warning('\nNo workspaces found'));
          return;
        }

        // Create a nicely formatted table
        console.log(theme.primary('\nAvailable workspaces:'));
        
        // Table header
        const header = `${table.topLeft}${'─'.repeat(20)}${table.cross}${'─'.repeat(20)}${table.topRight}`;
        console.log(header);
        console.log(`${table.vertical}${theme.header(' NAME').padEnd(20)}${table.vertical}${theme.header(' SLUG').padEnd(20)}${table.vertical}`);
        console.log(`${table.vertical}${theme.border('─'.repeat(19))}${table.vertical}${theme.border('─'.repeat(19))}${table.vertical}`);

        // Table rows
        workspaces.forEach(w => {
          console.log(
            `${table.vertical} ${theme.primary(w.name.padEnd(18))}${table.vertical} ${theme.info(w.slug.padEnd(18))}${table.vertical}`
          );
        });

        // Table footer
        console.log(`${table.bottomLeft}${'─'.repeat(20)}${table.cross}${'─'.repeat(20)}${table.bottomRight}`);
      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          console.error(theme.error('Authentication failed. Please run "nile auth login" first'));
        } else {
          console.error(theme.error('Failed to list workspaces:'), error.message || error);
        }
        process.exit(1);
      }
    });

  workspace
    .command('select <workspaceSlug>')
    .description('Select a workspace to use')
    .action(async (workspaceSlug) => {
      try {
        const options = getOptions();
        const token = await getAuthToken(options);
        const api = new NileAPI({
          token,
          debug: options.debug,
          controlPlaneUrl: options.globalHost,
          dbHost: options.dbHost
        });
        const workspace = await api.getWorkspace(workspaceSlug);
        await Config.setWorkspace(workspace);
        console.log(theme.success(`Selected workspace '${theme.bold(workspace.name)}'`));
      } catch (error: any) {
        console.error(theme.error('Failed to select workspace:'), error.message || error);
        process.exit(1);
      }
    });

  workspace
    .command('show')
    .description('Show current workspace')
    .action(async () => {
      try {
        const workspace = await Config.getWorkspace();
        if (!workspace) {
          console.log(theme.warning('No workspace selected'));
          console.log(theme.secondary('Run "nile workspace select <name>" to select a workspace'));
          return;
        }

        if (getOptions().format === 'json') {
          console.log(JSON.stringify(workspace, null, 2));
          return;
        }

        if (getOptions().format === 'csv') {
          console.log('NAME,SLUG');
          console.log(`${workspace.name},${workspace.slug}`);
          return;
        }

        console.log(theme.primary('\nCurrent workspace:'));
        console.log(`${theme.secondary('Name:')}  ${theme.primary(workspace.name)}`);
        console.log(`${theme.secondary('Slug:')}  ${theme.info(workspace.slug)}`);
      } catch (error: any) {
        console.error(theme.error('Failed to get workspace:'), error.message || error);
        process.exit(1);
      }
    });

  return workspace;
} 