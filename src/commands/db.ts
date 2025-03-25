import { Command } from 'commander';
import { ConfigManager } from '../lib/config';
import { NileAPI } from '../lib/api';
import { theme, formatCommand } from '../lib/colors';
import { GlobalOptions, getGlobalOptionsHelp } from '../lib/globalOptions';
import { spawn } from 'child_process';
import Table from 'cli-table3';
import { handleDatabaseError, forceRelogin } from '../lib/errorHandling';
import axios from 'axios';

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
        let token = configManager.getToken();
        
        if (!token) {
          await forceRelogin(configManager);
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

        const workspaceSlug = configManager.getWorkspace();
        if (!workspaceSlug) {
          throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <n>\n' +
            '3. NILE_WORKSPACE environment variable');
        }

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
          console.log(theme.warning(`\nNo databases found in workspace '${theme.bold(configManager.getWorkspace())}'`));
          console.log(theme.secondary('Run "nile db create" to create a database'));
          return;
        }

        // Create a nicely formatted table using cli-table3
        console.log(theme.primary(`\nDatabases in workspace '${theme.bold(configManager.getWorkspace())}':`));
        
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
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
          await handleDatabaseError(error, 'list databases', new ConfigManager(getOptions()));
        } else {
          throw error;
        }
      }
    });

  db
    .command('show <name>')
    .description('Show database details')
    .action(async (name: string) => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager(options);
        let token = configManager.getToken();
        
        if (!token) {
          await forceRelogin(configManager);
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

        const workspaceSlug = configManager.getWorkspace();
        if (!workspaceSlug) {
          throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <n>\n' +
            '3. NILE_WORKSPACE environment variable');
        }

        const database = await api.getDatabase(workspaceSlug, name);

        if (options.format === 'json') {
          console.log(JSON.stringify(database, null, 2));
          return;
        }

        if (options.format === 'csv') {
          console.log('NAME,REGION,STATUS');
          console.log(`${database.name},${database.region},${database.status}`);
          return;
        }

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
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
          await handleDatabaseError(error, 'get database details', new ConfigManager(getOptions()));
        } else {
          throw error;
        }
      }
    });

  db
    .command('create')
    .description('Create a new database')
    .requiredOption('--name <name>', 'Database name')
    .requiredOption('--region <region>', 'Database region')
    .action(async (options: { name: string; region: string }) => {
      try {
        const globalOptions = getOptions();
        const configManager = new ConfigManager(globalOptions);
        let token = configManager.getToken();
        
        if (!token) {
          await forceRelogin(configManager);
          token = configManager.getToken();
          if (!token) {
            throw new Error('Failed to get token after re-login');
          }
        }

        const api = new NileAPI({
          token,
          dbHost: configManager.getDbHost(),
          controlPlaneUrl: configManager.getGlobalHost(),
          debug: globalOptions.debug
        });

        const workspaceSlug = configManager.getWorkspace();
        if (!workspaceSlug) {
          throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <n>\n' +
            '3. NILE_WORKSPACE environment variable');
        }

        const database = await api.createDatabase(workspaceSlug, options.name, options.region);

        if (globalOptions.format === 'json') {
          console.log(JSON.stringify(database, null, 2));
          return;
        }

        if (globalOptions.format === 'csv') {
          console.log('NAME,REGION,STATUS');
          console.log(`${database.name},${database.region},${database.status}`);
          return;
        }

        console.log(`${theme.secondary('Name:')}    ${theme.primary(database.name)}`);
        console.log(`${theme.secondary('Region:')}  ${theme.info(database.region)}`);
        console.log(`${theme.secondary('Status:')}  ${formatStatus(database.status)}`);
      } catch (error: any) {
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
          await handleDatabaseError(error, 'create database', new ConfigManager(getOptions()));
        } else {
          throw error;
        }
      }
    });

  db
    .command('delete <name>')
    .description('Delete a database')
    .action(async (name: string) => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager(options);
        let token = configManager.getToken();
        
        if (!token) {
          await forceRelogin(configManager);
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

        const workspaceSlug = configManager.getWorkspace();
        if (!workspaceSlug) {
          throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <n>\n' +
            '3. NILE_WORKSPACE environment variable');
        }

        await api.deleteDatabase(workspaceSlug, name);
        console.log(theme.success('Database deleted successfully.'));
      } catch (error: any) {
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
          await handleDatabaseError(error, 'delete database', new ConfigManager(getOptions()));
        } else {
          throw error;
        }
      }
    });

  db
    .command('regions')
    .description('List available regions')
    .action(async () => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager(options);
        let token = configManager.getToken();
        
        if (!token) {
          await forceRelogin(configManager);
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

        const workspaceSlug = configManager.getWorkspace();
        if (!workspaceSlug) {
          throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <n>\n' +
            '3. NILE_WORKSPACE environment variable');
        }

        const regions = await api.listRegions(workspaceSlug);

        if (options.format === 'json') {
          console.log(JSON.stringify(regions, null, 2));
          return;
        }

        if (options.format === 'csv') {
          console.log('NAME');
          regions.forEach(r => {
            console.log(r);
          });
          return;
        }

        console.log('\nAvailable regions:');
        const regionsTable = new Table({
          head: [
            theme.header('NAME')
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

        regions.forEach(r => {
          regionsTable.push([
            theme.primary(r)
          ]);
        });

        console.log(regionsTable.toString());
      } catch (error: any) {
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
          await handleDatabaseError(error, 'list regions', new ConfigManager(getOptions()));
        } else {
          throw error;
        }
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
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
          await handleDatabaseError(error, 'connect to database', new ConfigManager(getOptions()));
        } else {
          throw error;
        }
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
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
          await handleDatabaseError(error, 'get connection string', new ConfigManager(getOptions()));
        } else {
          throw error;
        }
      }
    });

  return db;
}

function formatStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'running':
      return theme.success(status);
    case 'creating':
      return theme.warning(status);
    case 'error':
      return theme.error(status);
    default:
      return theme.info(status);
  }
}