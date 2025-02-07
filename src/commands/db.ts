import { Command } from 'commander';
import { ConfigManager } from '../lib/config';
import { NileAPI } from '../lib/api';
import { theme, table, formatStatus, formatCommand } from '../lib/colors';
import { GlobalOptions, getGlobalOptionsHelp } from '../lib/globalOptions';
import { spawn } from 'child_process';
import Table from 'cli-table3';

type GetOptions = () => GlobalOptions;

export function createDbCommand(getOptions: GetOptions): Command {
  const db = new Command('db')
    .description('Manage databases')
    .addHelpText('after', `
Examples:
  ${formatCommand('nile db list')}                       List all databases
  ${formatCommand('nile db show mydb')}                  Show database details
  ${formatCommand('nile db create', '--name mydb --region AWS_US_WEST_2')}  Create a database
  ${formatCommand('nile db delete mydb')}                Delete a database
  ${formatCommand('nile config --db <n>')}           Set default database

${getGlobalOptionsHelp()}`);

  db
    .command('list')
    .description('List all databases')
    .action(async () => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager(options);
        const workspaceSlug = configManager.getWorkspace();
        if (!workspaceSlug) {
          throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <name>\n' +
            '3. NILE_WORKSPACE environment variable');
        }

        const api = new NileAPI({
          token: configManager.getToken(),
          dbHost: configManager.getDbHost(),
          controlPlaneUrl: configManager.getGlobalHost(),
          debug: options.debug
        });
        const databases = await api.listDatabases(workspaceSlug);

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
          console.log(theme.warning(`\nNo databases found in workspace '${theme.bold(workspaceSlug)}'`));
          return;
        }

        // Create a nicely formatted table using cli-table3
        console.log(theme.primary(`\nDatabases in workspace '${theme.bold(workspaceSlug)}':`));
        
        const table = new Table({
          head: [
            theme.header('NAME'),
            theme.header('REGION'),
            theme.header('STATUS')
          ],
          style: {
            head: [],  // Disable default styling
            border: [], // Disable default styling
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
        databases.forEach((db) => {
          table.push([
            theme.primary(db.name),
            theme.info(db.region),
            formatStatus(db.status)
          ]);
        });

        // Print the table
        console.log(table.toString());
      } catch (error: any) {
        const options = getOptions();
        if (options.debug) {
          console.error(theme.error('Failed to list databases:'), error);
        } else {
          console.error(theme.error('Failed to list databases:'), error.message || 'Unknown error');
        }
        process.exit(1);
      }
    });

  db
    .command('show [databaseName]')
    .description('Show database details')
    .action(async (databaseName) => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager(options);
        const workspaceSlug = configManager.getWorkspace();
        if (!workspaceSlug) {
          throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <name>\n' +
            '3. NILE_WORKSPACE environment variable');
        }

        const api = new NileAPI({
          token: configManager.getToken(),
          dbHost: configManager.getDbHost(),
          controlPlaneUrl: configManager.getGlobalHost(),
          debug: options.debug
        });

        // If no database name provided, try to get from config
        if (!databaseName) {
          databaseName = configManager.getDatabase();
          if (!databaseName) {
            throw new Error('No database specified. Use one of:\n' +
              '1. --db flag\n' +
              '2. nile config --db <name>\n' +
              '3. NILE_DB environment variable');
          }
        }

        const database = await api.getDatabase(workspaceSlug, databaseName);

        if (options.format === 'json') {
          console.log(JSON.stringify(database, null, 2));
          return;
        }

        if (options.format === 'csv') {
          console.log('NAME,REGION,STATUS');
          console.log(`${database.name},${database.region},${database.status}`);
          return;
        }

        console.log(theme.primary('\nDatabase details:'));
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
          [theme.secondary('Name:'), theme.primary(database.name)],
          [theme.secondary('Region:'), theme.info(database.region)],
          [theme.secondary('Status:'), formatStatus(database.status)]
        );

        console.log(detailsTable.toString());
      } catch (error: any) {
        const options = getOptions();
        if (options.debug) {
          console.error(theme.error('Failed to get database:'), error);
        } else {
          console.error(theme.error('Failed to get database:'), error.message || 'Unknown error');
        }
        process.exit(1);
      }
    });

  db
    .command('create')
    .description('Create a new database')
    .requiredOption('--name <n>', 'Database name')
    .requiredOption('--region <r>', 'Region (use "nile db regions" to list available regions)')
    .action(async (cmdOptions) => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager(options);
        const workspaceSlug = configManager.getWorkspace();
        if (!workspaceSlug) {
          throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <n>\n' +
            '3. NILE_WORKSPACE environment variable');
        }

        const api = new NileAPI({
          token: configManager.getToken(),
          dbHost: configManager.getDbHost(),
          controlPlaneUrl: configManager.getGlobalHost(),
          debug: options.debug
        });

        // If region not provided, list available regions
        if (!cmdOptions.region) {
          const regions = await api.listRegions(workspaceSlug);
          console.log(theme.primary('\nAvailable regions:'));
          const regionsTable = new Table({
            head: [theme.header('REGION')],
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

          regions.forEach(region => {
            regionsTable.push([theme.info(region)]);
          });

          console.log(regionsTable.toString());
          console.log(theme.secondary('\nPlease specify a region using --region flag'));
          process.exit(1);
        }
        
        console.log(theme.primary(`Creating database '${theme.bold(cmdOptions.name)}' in region '${theme.info(cmdOptions.region)}'...`));
        const database = await api.createDatabase(workspaceSlug, cmdOptions.name, cmdOptions.region);
        console.log(theme.success(`Database '${theme.bold(database.name)}' created successfully.`));
        
        // Show database details
        console.log(theme.primary('\nDatabase details:'));
        console.log(`${theme.secondary('Name:')}    ${theme.primary(database.name)}`);
        console.log(`${theme.secondary('Region:')}  ${theme.info(database.region)}`);
        console.log(`${theme.secondary('Status:')}  ${formatStatus(database.status)}`);
      } catch (error: any) {
        const options = getOptions();
        if (error.response?.data?.errors) {
          console.error(theme.error('Failed to create database:'), new Error(error.response.data.errors.join(', ')));
        } else {
          if (options.debug) {
            console.error(theme.error('Failed to create database:'), error);
          } else {
            console.error(theme.error('Failed to create database:'), error instanceof Error ? error.message : 'Unknown error');
          }
        }
        process.exit(1);
      }
    });

  db
    .command('delete [databaseName]')
    .description('Delete a database permanently')
    .option('--force', 'Skip confirmation prompt (use with caution)')
    .action(async (databaseName, cmdOptions) => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager(options);
        const workspaceSlug = configManager.getWorkspace();
        if (!workspaceSlug) {
          throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <name>\n' +
            '3. NILE_WORKSPACE environment variable');
        }

        const api = new NileAPI({
          token: configManager.getToken(),
          dbHost: configManager.getDbHost(),
          controlPlaneUrl: configManager.getGlobalHost(),
          debug: options.debug
        });

        // If no database name provided, try to get from config
        if (!databaseName) {
          databaseName = configManager.getDatabase();
          if (!databaseName) {
            throw new Error('No database specified. Use one of:\n' +
              '1. --db flag\n' +
              '2. nile config --db <name>\n' +
              '3. NILE_DB environment variable');
          }
        }

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
        await api.deleteDatabase(workspaceSlug, databaseName);
        console.log(theme.success('Database deleted successfully.'));
      } catch (error: any) {
        const options = getOptions();
        if (options.debug) {
          console.error(theme.error('Failed to delete database:'), error);
        } else {
          console.error(theme.error('Failed to delete database:'), error.message || 'Unknown error');
        }
        process.exit(1);
      }
    });

  db
    .command('regions')
    .description('List all available regions for database creation')
    .action(async () => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager(options);
        const workspaceSlug = configManager.getWorkspace();
        if (!workspaceSlug) {
          throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <name>\n' +
            '3. NILE_WORKSPACE environment variable');
        }

        const api = new NileAPI({
          token: configManager.getToken(),
          dbHost: configManager.getDbHost(),
          controlPlaneUrl: configManager.getGlobalHost(),
          debug: options.debug
        });
        const regions = await api.listRegions(workspaceSlug);

        if (options.format === 'json') {
          console.log(JSON.stringify(regions, null, 2));
          return;
        }

        if (options.format === 'csv') {
          console.log('REGION');
          regions.forEach(region => console.log(region));
          return;
        }

        if (regions.length === 0) {
          console.log(theme.warning('\nNo regions available.'));
          return;
        }

        console.log(theme.primary('\nAvailable regions:'));
        const regionsTable = new Table({
          head: [theme.header('REGION')],
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

        regions.forEach(region => {
          regionsTable.push([theme.info(region)]);
        });

        console.log(regionsTable.toString());
      } catch (error: any) {
        const options = getOptions();
        if (options.debug) {
          console.error(theme.error('Failed to list regions:'), error);
        } else {
          console.error(theme.error('Failed to list regions:'), error.message || 'Unknown error');
        }
        process.exit(1);
      }
    });

  db
    .command('psql')
    .description('Connect to database using psql')
    .option('--name <n>', 'Database name (overrides selected database)')
    .action(async (cmdOptions) => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager(options);
        const workspaceSlug = configManager.getWorkspace();
        if (!workspaceSlug) {
          throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <name>\n' +
            '3. NILE_WORKSPACE environment variable');
        }

        // Get database name from command option or config
        let databaseName = cmdOptions.name;
        if (!databaseName) {
          databaseName = configManager.getDatabase();
          if (!databaseName) {
            throw new Error('No database specified. Use one of:\n' +
              '1. --db flag\n' +
              '2. nile config --db <name>\n' +
              '3. NILE_DB environment variable');
          }
        }

        const api = new NileAPI({
          token: configManager.getToken(),
          dbHost: configManager.getDbHost(),
          controlPlaneUrl: configManager.getGlobalHost(),
          debug: options.debug
        });

        // Get database connection details
        const connection = await api.getDatabaseConnection(workspaceSlug, databaseName);

        // Construct psql connection string
        const connectionString = `postgres://${connection.user}:${connection.password}@${connection.host}:${connection.port}/${connection.database}`;

        // Execute psql command
        const psql = spawn('psql', [connectionString], {
          stdio: 'inherit'
        });

        psql.on('error', (error: any) => {
          const options = getOptions();
          if (error.code === 'ENOENT') {
            console.error(theme.error('\nError: psql command not found. Please install PostgreSQL client tools.'));
            process.exit(1);
          } else {
            if (options.debug) {
              console.error(theme.error('\nError executing psql:'), error);
            } else {
              console.error(theme.error('\nError executing psql:'), error.message || 'Unknown error');
            }
            process.exit(1);
          }
        });

        psql.on('exit', (code: number) => {
          if (code !== 0) {
            console.error(theme.error('\npsql exited with code:'), code);
            process.exit(code);
          }
        });
      } catch (error: any) {
        const options = getOptions();
        if (options.debug) {
          console.error(theme.error('Failed to connect to database:'), error);
        } else {
          console.error(theme.error('Failed to connect to database:'), error.message || 'Unknown error');
        }
        process.exit(1);
      }
    });

  db
    .command('connectionstring')
    .description('Get database connection string')
    .option('--name <n>', 'Database name (overrides selected database)')
    .requiredOption('--psql', 'Get PostgreSQL connection string')
    .action(async (cmdOptions) => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager(options);
        const workspaceSlug = configManager.getWorkspace();
        if (!workspaceSlug) {
          throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <name>\n' +
            '3. NILE_WORKSPACE environment variable');
        }

        // Get database name from command option or config
        let databaseName = cmdOptions.name;
        if (!databaseName) {
          databaseName = configManager.getDatabase();
          if (!databaseName) {
            throw new Error('No database specified. Use one of:\n' +
              '1. --db flag\n' +
              '2. nile config --db <name>\n' +
              '3. NILE_DB environment variable');
          }
        }

        const api = new NileAPI({
          token: configManager.getToken(),
          dbHost: configManager.getDbHost(),
          controlPlaneUrl: configManager.getGlobalHost(),
          debug: options.debug
        });

        // Get database connection details
        const connection = await api.getDatabaseConnection(workspaceSlug, databaseName);

        // Construct psql connection string
        const connectionString = `postgres://${connection.user}:${connection.password}@${connection.host}:${connection.port}/${connection.database}`;

        // Output the connection string
        console.log(connectionString);
      } catch (error: any) {
        const options = getOptions();
        if (options.debug) {
          console.error(theme.error('Failed to get connection string:'), error);
        } else {
          console.error(theme.error('Failed to get connection string:'), error.message || 'Unknown error');
        }
        process.exit(1);
      }
    });

  return db;
}