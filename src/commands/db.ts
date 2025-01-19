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
  dbHost?: string;
}

type GetOptions = () => GlobalOptions;

export function createDbCommand(getOptions: GetOptions): Command {
  const db = new Command('db')
    .description('Manage Nile databases')
    .addHelpText('after', `
Examples:
  ${formatCommand('nile db list')}                        List all databases in current workspace
  ${formatCommand('nile db create', '--name mydb --region AWS_US_WEST_2')}   Create a new database
  ${formatCommand('nile db select mydb')}                 Select a default database
  ${formatCommand('nile db show')}                        Show details of selected database
  ${formatCommand('nile db psql')}                        Connect to selected database
  ${formatCommand('nile db connectionstring', '--psql')}  Get PostgreSQL connection string
  ${formatCommand('nile db delete', '--force')}           Delete selected database without confirmation
  ${formatCommand('nile db regions')}                     List available regions`);

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
    .command('show [databaseName]')
    .description('Show detailed information about a specific database')
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
    .command('delete [databaseName]')
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

  db
    .command('regions')
    .description('List all available regions for database creation')
    .action(async () => {
      try {
        const workspace = await Config.getWorkspace();
        if (!workspace) {
          throw new Error('No workspace selected. Please run "nile workspace select" first');
        }

        const options = getOptions();
        const token = await getAuthToken(options);
        const api = new NileAPI(token, options.debug);
        const regions = await api.listRegions(workspace.slug);

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

        // Create a nicely formatted table
        console.log(theme.primary('\nAvailable regions:'));
        
        // Table header
        const header = `${table.topLeft}${'─'.repeat(30)}${table.topRight}`;
        console.log(header);
        console.log(`${table.vertical}${theme.header(' REGION').padEnd(30)}${table.vertical}`);
        console.log(`${table.vertical}${theme.border('─'.repeat(29))}${table.vertical}`);

        // Table rows
        regions.forEach(region => {
          console.log(`${table.vertical} ${theme.info(region.padEnd(28))}${table.vertical}`);
        });

        // Table footer
        console.log(`${table.bottomLeft}${'─'.repeat(30)}${table.bottomRight}`);
      } catch (error) {
        console.error(theme.error('Failed to list regions:'), error);
        process.exit(1);
      }
    });

  db
    .command('psql')
    .description('Connect to a database using psql')
    .option('--name <name>', 'Name of the database to connect to (optional if database is selected)')
    .option('--connection-string <string>', 'PostgreSQL connection string (if not provided, will create new credentials)')
    .action(async (cmdOptions) => {
      try {
        const workspace = await Config.getWorkspace();
        if (!workspace) {
          throw new Error('No workspace selected. Please run "nile workspace select" first');
        }

        const options = getOptions();
        const token = await getAuthToken(options);
        const api = new NileAPI(token, options.debug);

        let connectionString = cmdOptions.connectionString;

        // If no connection string provided, create new credentials
        if (!connectionString) {
          if (options.debug) {
            console.log(theme.dim('No connection string provided, creating new credentials...'));
          }
          
          const credentialsResponse = await api.createDatabaseCredentials(workspace.slug, cmdOptions.name);

          if (options.debug) {
            console.log(theme.dim('Raw credentials response:'), JSON.stringify(credentialsResponse, null, 2));
          }

          // Extract database info from response
          const region = credentialsResponse.database.region.toLowerCase();  // e.g., AWS_US_WEST_2 -> aws_us_west_2
          const regionParts = region.split('_');
          const regionPrefix = `${regionParts[1]}-${regionParts[2]}-${regionParts[3]}`;  // e.g., us-west-2
          
          // Use custom host if provided, otherwise use default with region prefix
          const dbHost = options.dbHost ? 
            `${regionPrefix}.${options.dbHost}` : 
            `${regionPrefix}.db.thenile.dev`;

          const dbPort = 5432;  // Default PostgreSQL port
          const dbName = credentialsResponse.database.name;  // Use the name from the response
          const username = credentialsResponse.id;  // Use the credential ID as username
          const password = credentialsResponse.password;

          if (!username || !password) {
            throw new Error('Missing required credentials (id or password) in server response');
          }

          connectionString = `postgres://${username}:${password}@${dbHost}:${dbPort}/${dbName}`;
          
          if (options.debug) {
            // Log connection details without sensitive info
            console.log(theme.dim('Connection details:'));
            console.log(theme.dim(`Host: ${dbHost}`));
            console.log(theme.dim(`Port: ${dbPort}`));
            console.log(theme.dim(`Database: ${dbName}`));
            console.log(theme.dim(`Username: ${username}`));
            console.log(theme.dim('Password: [hidden]'));
            console.log(theme.dim('\nConnection command:'));
            console.log(theme.dim(`psql "${connectionString.replace(/:[^:@]+@/, ':***@')}"`));
          }
        }

        console.log(theme.info(`\nConnecting to database '${theme.bold(cmdOptions.name)}'...`));
        
        // Spawn psql process with the connection string
        const { spawn } = require('child_process');
        const psql = spawn('psql', [connectionString], {
          stdio: 'inherit'  // This will connect the psql process to the current terminal
        });

        // Handle psql process events
        psql.on('error', (error: Error) => {
          if (error.message.includes('ENOENT')) {
            console.error(theme.error('\nError: psql command not found. Please install PostgreSQL command line tools.'));
            process.exit(1);
          } else {
            console.error(theme.error('\nFailed to start psql:'), error);
            process.exit(1);
          }
        });

        psql.on('exit', (code: number) => {
          if (code !== 0) {
            console.error(theme.error('\npsql connection terminated with error code:'), code);
            process.exit(code);
          }
        });
      } catch (error) {
        console.error(theme.error('Failed to connect to database:'), error);
        process.exit(1);
      }
    });

  db
    .command('connectionstring')
    .description('Generate a connection string for the database')
    .option('--name <name>', 'Name of the database to connect to (optional if database is selected)')
    .requiredOption('--psql', 'Generate PostgreSQL connection string')
    .action(async (cmdOptions) => {
      try {
        // Get database name from options or config
        let databaseName = cmdOptions.name;
        if (!databaseName) {
          const database = await Config.getDatabase();
          if (!database?.name) {
            throw new Error('No database specified. Please provide --name flag or run "nile db select" first');
          }
          databaseName = database.name;
        }

        const workspace = await Config.getWorkspace();
        if (!workspace) {
          throw new Error('No workspace selected. Please run "nile workspace select" first');
        }

        const options = getOptions();
        const token = await getAuthToken(options);
        const api = new NileAPI(token, options.debug);

        if (options.debug) {
          console.log(theme.dim('Creating new credentials...'));
        }
        
        const credentialsResponse = await api.createDatabaseCredentials(workspace.slug, databaseName);

        if (options.debug) {
          console.log(theme.dim('Raw credentials response:'), JSON.stringify(credentialsResponse, null, 2));
        }

        // Extract database info from response
        const region = credentialsResponse.database.region.toLowerCase();
        const regionParts = region.split('_');
        const regionPrefix = `${regionParts[1]}-${regionParts[2]}-${regionParts[3]}`;
        
        // Use custom host if provided, otherwise use default with region prefix
        const dbHost = options.dbHost ? 
          `${regionPrefix}.${options.dbHost}` : 
          `${regionPrefix}.db.thenile.dev`;

        const dbPort = 5432;
        const dbName = credentialsResponse.database.name;
        const username = credentialsResponse.id;
        const password = credentialsResponse.password;

        if (!username || !password) {
          throw new Error('Missing required credentials (id or password) in server response');
        }

        // PostgreSQL format: postgres://username:password@host:port/database
        const connectionString = `postgres://${username}:${password}@${dbHost}:${dbPort}/${dbName}`;
        // Print only the connection string without any formatting
        console.log(connectionString);
      } catch (error) {
        console.error(theme.error('Failed to generate connection string:'), error);
        process.exit(1);
      }
    });

  db
    .command('select <databaseName>')
    .description('Select a database to use as default')
    .action(async (databaseName) => {
      try {
        const workspace = await Config.getWorkspace();
        if (!workspace) {
          throw new Error('No workspace selected. Please run "nile workspace select" first');
        }

        // Save the database name in config
        await Config.setDatabase({ name: databaseName });
        console.log(theme.success(`Selected database: ${theme.bold(databaseName)}`));
      } catch (error) {
        console.error(theme.error('Failed to select database:'), error);
        process.exit(1);
      }
    });

  return db;
}