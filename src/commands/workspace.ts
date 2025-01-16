import { Command } from 'commander';
import { Config } from '../lib/config';
import { NileAPI } from '../lib/api';
import chalk from 'chalk';

export function createWorkspaceCommand(): Command {
  const workspace = new Command('workspace')
    .description('Manage workspaces');

  workspace
    .command('list')
    .description('List available workspaces')
    .action(async () => {
      try {
        const token = await Config.getToken();
        if (!token) {
          throw new Error('Not logged in. Please run "nile connect login" first');
        }

        const api = new NileAPI(token);
        const developer = await api.getDeveloperInfo();

        console.log(chalk.blue('Available Workspaces:'));
        developer.workspaces.forEach(ws => {
          console.log(chalk.green(`- ${ws.name}`));
        });
      } catch (error) {
        console.error(chalk.red('Failed to list workspaces:'), error);
        process.exit(1);
      }
    });

  workspace
    .command('select <workspaceName>')
    .description('Select a workspace')
    .action(async (workspaceName: string) => {
      try {
        const token = await Config.getToken();
        if (!token) {
          throw new Error('Not logged in. Please run "nile connect login" first');
        }

        const api = new NileAPI(token);
        const developer = await api.getDeveloperInfo();

        const workspace = developer.workspaces.find(ws => ws.name === workspaceName);
        if (!workspace) {
          throw new Error(`Workspace '${workspaceName}' not found`);
        }

        await Config.saveWorkspace(workspace);
        console.log(chalk.green(`Workspace switched to '${workspaceName}'`));
      } catch (error) {
        console.error(chalk.red('Failed to select workspace:'), error);
        process.exit(1);
      }
    });

  workspace
    .command('show')
    .description('Show the currently selected workspace')
    .action(async () => {
      try {
        const workspace = await Config.getWorkspace();
        if (!workspace) {
          console.log(chalk.yellow('No workspace currently selected'));
          return;
        }
        console.log(chalk.blue(`Current workspace: ${workspace.name}`));
      } catch (error) {
        console.error(chalk.red('Failed to show workspace:'), error);
        process.exit(1);
      }
    });

  return workspace;
} 