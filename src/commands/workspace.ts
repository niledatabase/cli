import { Command } from 'commander';
import { ConfigManager } from '../lib/config';
import { NileAPI } from '../lib/api';
import { theme, formatCommand } from '../lib/colors';
import { GlobalOptions, getGlobalOptionsHelp } from '../lib/globalOptions';
import { handleApiError, forceRelogin } from '../lib/errorHandling';
import Table from 'cli-table3';
import axios from 'axios';

type GetOptions = () => GlobalOptions;

export function createWorkspaceCommand(getOptions: GetOptions): Command {
  const workspace = new Command('workspace')
    .description('Manage workspaces')
    .addHelpText('after', `
Examples:
  ${formatCommand('nile workspace list')}                    List all workspaces
  ${formatCommand('nile workspace show')}                    Show current workspace
  ${formatCommand('nile workspace select <name>')}           Select a workspace
  ${formatCommand('nile workspace create --name "My Workspace"')}  Create a new workspace
  ${formatCommand('nile workspace delete <name>')}           Delete a workspace
  ${formatCommand('nile workspace update <name>')}           Update workspace settings

${getGlobalOptionsHelp()}`);

  workspace
    .command('list')
    .description('List all workspaces')
    .action(async () => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager(options);
        let token = configManager.getToken();
        
        if (!token) {
          await forceRelogin(configManager);
          // After re-login, get the new token
          token = configManager.getToken();
          if (!token) {
            throw new Error('Failed to get token after re-login');
          }
        }

        const api = new NileAPI({
          token,
          dbHost: configManager.getDbHost(),
          controlPlaneUrl: configManager.getGlobalHost(),
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
          console.log(theme.warning('\nNo workspaces found.'));
          console.log(theme.secondary('Run "nile workspace create" to create a workspace'));
          return;
        }

        console.log('\nWorkspaces:');
        const table = new Table({
          head: [
            theme.header('NAME'),
            theme.header('SLUG')
          ],
          style: { head: [], border: [] },
          chars: {
            'top': '─',
            'top-mid': '┬',
            'top-left': '┌',
            'top-right': '┐',
            'bottom': '─',
            'bottom-mid': '┴',
            'bottom-left': '└',
            'bottom-right': '┘',
            'left': '│',
            'left-mid': '├',
            'mid': '─',
            'mid-mid': '┼',
            'right': '│',
            'right-mid': '┤',
            'middle': '│'
          }
        });

        workspaces.forEach(w => {
          table.push([
            theme.primary(w.name),
            theme.info(w.slug)
          ]);
        });

        console.log(table.toString());
      } catch (error: any) {
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
          await handleApiError(error, 'list workspaces', new ConfigManager(getOptions()));
        } else {
          throw error;
        }
      }
    });

  workspace
    .command('show')
    .description('Show current workspace')
    .action(async () => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager(options);
        const workspaceSlug = configManager.getWorkspace();
        
        if (!workspaceSlug) {
          console.log(theme.warning('No workspace selected'));
          console.log(theme.secondary('Run "nile config --workspace <n>" to set a workspace'));
          return;
        }

        let token = configManager.getToken();
        if (!token) {
          await forceRelogin(configManager);
          token = configManager.getToken();
          if (!token) {
            throw new Error('Failed to get token after re-login');
          }
        }

        // Get workspace details from API
        const api = new NileAPI({
          token,
          dbHost: configManager.getDbHost(),
          controlPlaneUrl: configManager.getGlobalHost(),
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
        const detailsTable = new Table({
          style: {
            head: [],
            border: [],
          },
          chars: {
            'top': '─',
            'top-mid': '┬',
            'top-left': '┌',
            'top-right': '┐',
            'bottom': '─',
            'bottom-mid': '┴',
            'bottom-left': '└',
            'bottom-right': '┘',
            'left': '│',
            'left-mid': '├',
            'mid': '─',
            'mid-mid': '┼',
            'right': '│',
            'right-mid': '┤',
            'middle': '│'
          }
        });

        detailsTable.push(
          [theme.secondary('Name:'), theme.primary(workspace.name)],
          [theme.secondary('Slug:'), theme.info(workspace.slug)]
        );

        console.log(detailsTable.toString());
      } catch (error: any) {
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
          await handleApiError(error, 'get workspace details', new ConfigManager(getOptions()));
        } else {
          throw error;
        }
      }
    });

  return workspace;
} 