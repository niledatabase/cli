import { Command } from 'commander';
import { Config } from '../lib/config';
import { NileAPI } from '../lib/api';
import { getAuthToken, AuthOptions } from '../lib/authUtils';
import chalk from 'chalk';
import axios from 'axios';

type GetOptions = () => AuthOptions;

export function createWorkspaceCommand(getOptions: GetOptions): Command {
  const workspace = new Command('workspace')
    .description('Manage workspaces');

  workspace
    .command('list')
    .description('List available workspaces')
    .option('--format <type>', 'Output format (human, json)', 'human')
    .action(async (options) => {
      try {
        const token = await getAuthToken(getOptions());
        const api = new NileAPI(token);
        const developer = await api.getDeveloperInfo();

        if (options.format === 'json') {
          console.log(JSON.stringify(developer.workspaces, null, 2));
          return;
        }

        if (developer.workspaces.length === 0) {
          console.log(chalk.yellow('\nNo workspaces available.'));
          return;
        }

        console.log(chalk.blue('\nAvailable Workspaces:'));
        developer.workspaces.forEach((ws) => {
          console.log(`- ${ws.name}`);
          console.log(`  ID: ${ws.id || 'N/A'}`);
          console.log(`  Slug: ${ws.slug}`);
          if (ws.created) {
            console.log(`  Created: ${new Date(ws.created).toLocaleString()}`);
          }
          console.log('');
        });
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          console.error(chalk.red('Authentication failed. Please run "nile connect login" or provide a valid API key.'));
        } else {
          console.error(chalk.red('Failed to list workspaces:'), error);
        }
        process.exit(1);
      }
    });

  workspace
    .command('select <workspaceSlug>')
    .description('Select a workspace by its slug')
    .action(async (workspaceSlug) => {
      try {
        // Create a workspace object with the provided slug
        const workspace = {
          name: workspaceSlug, // Using slug as name initially
          slug: workspaceSlug,
        };

        await Config.saveWorkspace(workspace);
        console.log(chalk.green(`Workspace context set to '${workspaceSlug}'`));
      } catch (error) {
        console.error(chalk.red('Failed to set workspace:'), error);
        process.exit(1);
      }
    });

  workspace
    .command('show')
    .description('Show current workspace')
    .option('--format <type>', 'Output format (human, json)', 'human')
    .action(async (options) => {
      try {
        const workspace = await Config.getWorkspace();
        
        if (options.format === 'json') {
          console.log(JSON.stringify(workspace || {}, null, 2));
          return;
        }

        if (workspace) {
          console.log(chalk.blue('\nCurrent Workspace:'));
          console.log(`Name: ${workspace.name}`);
          console.log(`Slug: ${workspace.slug}`);
        } else {
          console.log(chalk.yellow('No workspace selected'));
        }
      } catch (error) {
        console.error(chalk.red('Failed to show workspace:'), error);
        process.exit(1);
      }
    });

  return workspace;
} 