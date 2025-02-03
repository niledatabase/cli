import { Command } from 'commander';
import { ConfigManager } from '../lib/config';
import { NileAPI } from '../lib/api';
import { theme, table, formatCommand } from '../lib/colors';
import { GlobalOptions, getGlobalOptionsHelp } from '../lib/globalOptions';
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
  ${formatCommand('nile workspace show')}                Show current workspace
  ${formatCommand('nile config --workspace <name>')}     Set default workspace

${getGlobalOptionsHelp()}`);

  workspace
    .command('list')
    .description('List all workspaces')
    .action(async () => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager();
        configManager.initializeWithOptions(options);
        const api = new NileAPI({
          token: configManager.getToken(),
          dbHost: configManager.getDbHost(options),
          controlPlaneUrl: configManager.getGlobalHost(options),
          debug: options.debug
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
    .command('show')
    .description('Show current workspace')
    .action(async () => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager();
        const workspaceSlug = configManager.getWorkspace(options);
        
        if (!workspaceSlug) {
          console.log(theme.warning('No workspace selected'));
          console.log(theme.secondary('Run "nile config --workspace <n>" to set a workspace'));
          return;
        }

        // Get workspace details from API
        const api = new NileAPI({
          token: configManager.getToken(),
          dbHost: configManager.getDbHost(options),
          controlPlaneUrl: configManager.getGlobalHost(options),
          debug: options.debug
        });
        const workspace = await api.getWorkspace(workspaceSlug);

        if (options.format === 'json') {
          console.log(JSON.stringify(workspace, null, 2));
          return;
        }

        if (options.format === 'csv') {
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