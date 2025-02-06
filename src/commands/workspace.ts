import { Command } from 'commander';
import { ConfigManager } from '../lib/config';
import { NileAPI } from '../lib/api';
import { theme, formatCommand } from '../lib/colors';
import { GlobalOptions, getGlobalOptionsHelp } from '../lib/globalOptions';
import axios from 'axios';
import Table from 'cli-table3';

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
        const configManager = new ConfigManager(options);
        const api = new NileAPI({
          token: configManager.getToken(),
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
          console.log(theme.warning('\nNo workspaces found'));
          return;
        }

        // Create a nicely formatted table using cli-table3
        console.log(theme.primary('\nAvailable workspaces:'));
        
        const table = new Table({
          head: [
            theme.header('NAME'),
            theme.header('SLUG')
          ],
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

        // Add rows to the table
        workspaces.forEach(w => {
          table.push([
            theme.primary(w.name),
            theme.info(w.slug)
          ]);
        });

        console.log(table.toString());
      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          console.error(theme.error('Authentication failed. Please run "nile connect login" first'));
        } else {
          const options = getOptions();
          if (options.debug) {
            console.error(theme.error('Failed to list workspaces:'), error);
          } else {
            console.error(theme.error('Failed to list workspaces:'), error.message || 'Unknown error');
          }
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
        const configManager = new ConfigManager(options);
        const workspaceSlug = configManager.getWorkspace();
        
        if (!workspaceSlug) {
          console.log(theme.warning('No workspace selected'));
          console.log(theme.secondary('Run "nile config --workspace <n>" to set a workspace'));
          return;
        }

        // Get workspace details from API
        const api = new NileAPI({
          token: configManager.getToken(),
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
        const options = getOptions();
        if (options.debug) {
          console.error(theme.error('Failed to get workspace:'), error);
        } else {
          console.error(theme.error('Failed to get workspace:'), error.message || 'Unknown error');
        }
        process.exit(1);
      }
    });

  return workspace;
} 