import { Command } from 'commander';
import { Config } from '../lib/config';
import { NileAPI } from '../lib/api';
import { getAuthToken } from '../lib/authUtils';
import { theme, table, formatStatus, formatCommand } from '../lib/colors';

interface GlobalOptions {
  apiKey?: string;
  format?: 'human' | 'json' | 'csv';
  color?: boolean;
  debug?: boolean;
}

type GetOptions = () => GlobalOptions;

export function createDbCommand(getOptions: GetOptions): Command {
  const db = new Command('db')
    .description('Manage Nile databases')
    .addHelpText('after', `
Examples:
  ${formatCommand('nile db list')}                        List all databases in current workspace
  ${formatCommand('nile db create', '--name mydb --region AWS_US_WEST_2')}   Create a new database
  ${formatCommand('nile db show mydb')}                   Show database details
  ${formatCommand('nile db delete mydb --force')}         Delete a database without confirmation`);

  db
    .command('list')
    .description('List all databases in the current workspace. Supports --format option for output formatting.')
    .action(async () => {
      try {
        const workspace = await Config.getWorkspace();
        if (!workspace) {
          throw new Error('No workspace selected. Please run "nile workspace select" first');
        }

        const options = getOptions();
        const token = await getAuthToken(options);
        const api = new NileAPI(token, options.debug);
        const databases = await api.listDatabases(workspace.slug);

        if (options.format === 'json') {
          console.log(JSON.stringify(databases, null, 2));
          return;
        }

        if (options.format === 'csv') {
          console.log('NAME,REGION,STATUS');
          databases.forEach((db) => {
            console.log(`${db.name},${db.region},${db.status}`);
          });
          return;
        }

        if (databases.length === 0) {
          console.log(theme.warning(`\nNo databases found in workspace '${theme.bold(workspace.name)}'`));
          return;
        }

        // Create a nicely formatted table
        console.log(theme.primary(`\nDatabases in workspace '${theme.bold(workspace.name)}':`));
        
        // Table header
        const header = `${table.topLeft}${'─'.repeat(20)}${table.cross}${'─'.repeat(15)}${table.cross}${'─'.repeat(10)}${table.topRight}`;
        console.log(header);
        console.log(`${table.vertical}${theme.header(' NAME').padEnd(20)}${table.vertical}${theme.header(' REGION').padEnd(15)}${table.vertical}${theme.header(' STATUS').padEnd(10)}${table.vertical}`);
        console.log(`${table.vertical}${theme.border('─'.repeat(19))}${table.vertical}${theme.border('─'.repeat(14))}${table.vertical}${theme.border('─'.repeat(9))}${table.vertical}`);

        // Table rows
        databases.forEach((db) => {
          console.log(
            `${table.vertical} ${theme.primary(db.name.padEnd(18))}${table.vertical} ${theme.info(db.region.padEnd(13))}${table.vertical} ${formatStatus(db.status.padEnd(8))}${table.vertical}`
          );
        });

        // Table footer
        console.log(`${table.bottomLeft}${'─'.repeat(20)}${table.cross}${'─'.repeat(15)}${table.cross}${'─'.repeat(10)}${table.bottomRight}`);
      } catch (error) {
        console.error(theme.error('Failed to list databases:'), error);
        process.exit(1);
      }
    });

  db
    .command('create')
    .description('Create a new database in the specified region')
    .requiredOption('--name <name>', 'Name of the database to create')
    .option('--region <region>', 'Region where the database will be created (if not specified, available regions will be listed)')
    .action(async (cmdOptions) => {
      try {
        const workspace = await Config.getWorkspace();
        if (!workspace) {
          throw new Error('No workspace selected. Please run "nile workspace select" first');
        }

        const options = getOptions();
        const token = await getAuthToken(options);
        const api = new NileAPI(token, options.debug);

        // If region not provided, list available regions
        if (!cmdOptions.region) {
          const regions = await api.listRegions(workspace.slug);
          console.log(theme.primary('\nAvailable regions:'));
          regions.forEach(region => console.log(theme.info(`- ${region}`)));
          console.log(theme.secondary('\nPlease specify a region using --region flag'));
          process.exit(1);
        }
        
        console.log(theme.primary(`Creating database '${theme.bold(cmdOptions.name)}' in region '${theme.info(cmdOptions.region)}'...`));
        const database = await api.createDatabase(workspace.slug, cmdOptions.name, cmdOptions.region);
        console.log(theme.success(`Database '${theme.bold(database.name)}' created successfully.`));
        
        // Show database details
        console.log(theme.primary('\nDatabase details:'));
        console.log(`${theme.secondary('Name:')}    ${theme.primary(database.name)}`);
        console.log(`${theme.secondary('Region:')}  ${theme.info(database.region)}`);
        console.log(`${theme.secondary('Status:')}  ${formatStatus(database.status)}`);
      } catch (error) {
        console.error(theme.error('Failed to create database:'), error);
        process.exit(1);
      }
    });

  db
    .command('show <databaseName>')
    .description('Show detailed information about a specific database. Supports --format option for output formatting.')
    .action(async (databaseName) => {
      try {
        const workspace = await Config.getWorkspace();
        if (!workspace) {
          throw new Error('No workspace selected. Please run "nile workspace select" first');
        }

        const options = getOptions();
        const token = await getAuthToken(options);
        const api = new NileAPI(token, options.debug);
        const database = await api.getDatabase(workspace.slug, databaseName);

        if (options.format === 'json') {
          console.log(JSON.stringify(database, null, 2));
          return;
        }

        if (options.format === 'csv') {
          console.log('NAME,REGION,STATUS');
          console.log(`${database.name},${database.region},${database.status}`);
          return;
        }

        console.log(theme.primary(`\nDatabase '${theme.bold(database.name)}' details:`));
        console.log(`${theme.secondary('Name:')}    ${theme.primary(database.name)}`);
        console.log(`${theme.secondary('Region:')}  ${theme.info(database.region)}`);
        console.log(`${theme.secondary('Status:')}  ${formatStatus(database.status)}`);
      } catch (error) {
        console.error(theme.error('Failed to get database details:'), error);
        process.exit(1);
      }
    });

  db
    .command('delete <databaseName>')
    .description('Delete a database permanently')
    .option('--force', 'Skip confirmation prompt (use with caution)')
    .action(async (databaseName, cmdOptions) => {
      try {
        const workspace = await Config.getWorkspace();
        if (!workspace) {
          throw new Error('No workspace selected. Please run "nile workspace select" first');
        }

        const options = getOptions();
        const token = await getAuthToken(options);
        const api = new NileAPI(token, options.debug);

        if (!cmdOptions.force) {
          console.log(theme.warning(`\n⚠️  WARNING: This will permanently delete database '${theme.bold(databaseName)}' and all its data.`));
          console.log(theme.warning('This action cannot be undone.'));
          process.stdout.write(theme.warning('Are you sure? (yes/no): '));

          const answer = await new Promise<string>(resolve => {
            process.stdin.once('data', data => {
              resolve(data.toString().trim().toLowerCase());
            });
          });

          if (answer !== 'yes' && answer !== 'y') {
            console.log(theme.info('\nDatabase deletion cancelled.'));
            process.exit(0);
          }
        }

        console.log(theme.primary(`\nDeleting database '${theme.bold(databaseName)}'...`));
        await api.deleteDatabase(workspace.slug, databaseName);
        console.log(theme.success('Database deleted successfully.'));
      } catch (error) {
        console.error(theme.error('Failed to delete database:'), error);
        process.exit(1);
      }
    });

  return db;
}