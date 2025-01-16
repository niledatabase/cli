import { Command } from 'commander';
import { Config } from '../lib/config';
import { NileAPI } from '../lib/api';
import chalk from 'chalk';

export function createDbCommand(): Command {
  const db = new Command('db')
    .description('Manage databases');

  db
    .command('list')
    .description('List databases in the current workspace')
    .action(async () => {
      try {
        const token = await Config.getToken();
        if (!token) {
          throw new Error('Not logged in. Please run "nile connect login" first');
        }

        const workspace = await Config.getWorkspace();
        if (!workspace) {
          throw new Error('No workspace selected. Please run "nile workspace select" first');
        }

        const api = new NileAPI(token);
        const databases = await api.listDatabases(workspace.slug);

        console.log(chalk.blue('Databases:'));
        databases.forEach(db => {
          console.log(chalk.green(`- ${db.name} (${db.region}) - ${db.status}`));
        });
      } catch (error) {
        console.error(chalk.red('Failed to list databases:'), error);
        process.exit(1);
      }
    });

  db
    .command('create')
    .description('Create a new database')
    .requiredOption('--name <name>', 'database name')
    .requiredOption('--region <region>', 'database region')
    .action(async (options) => {
      try {
        const token = await Config.getToken();
        if (!token) {
          throw new Error('Not logged in. Please run "nile connect login" first');
        }

        const workspace = await Config.getWorkspace();
        if (!workspace) {
          throw new Error('No workspace selected. Please run "nile workspace select" first');
        }

        const api = new NileAPI(token);
        await api.createDatabase(workspace.slug, options.name, options.region);
        console.log(chalk.green(`Database '${options.name}' created successfully`));
      } catch (error) {
        console.error(chalk.red('Failed to create database:'), error);
        process.exit(1);
      }
    });

  return db;
} 