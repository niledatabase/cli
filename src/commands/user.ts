import { Command } from 'commander';
import { Client } from 'pg';
import { ConfigManager } from '../lib/config';
import { NileAPI } from '../lib/api';
import { theme, formatCommand } from '../lib/colors';
import { GlobalOptions, getGlobalOptionsHelp } from '../lib/globalOptions';
import { handleUserError, forceRelogin } from '../lib/errorHandling';
import Table from 'cli-table3';
import axios from 'axios';

async function getWorkspaceAndDatabase(options: GlobalOptions): Promise<{ workspaceSlug: string; databaseName: string }> {
  const configManager = new ConfigManager(options);
  const workspaceSlug = configManager.getWorkspace();
  if (!workspaceSlug) {
    throw new Error('No workspace specified. Use one of:\n' +
      '1. --workspace flag\n' +
      '2. nile config --workspace <n>\n' +
      '3. NILE_WORKSPACE environment variable');
  }

  const databaseName = configManager.getDatabase();
  if (!databaseName) {
    throw new Error('No database specified. Use one of:\n' +
      '1. --db flag\n' +
      '2. nile config --db <n>\n' +
      '3. NILE_DB environment variable');
  }

  return { workspaceSlug, databaseName };
}

async function getPostgresClient(api: NileAPI, workspaceSlug: string, databaseName: string, options: GlobalOptions): Promise<Client> {
  // Get database credentials from control plane
  console.log(theme.dim('\nFetching database credentials...'));
  const credentials = await api.createDatabaseCredentials(workspaceSlug, databaseName);

  if (!credentials.id || !credentials.password) {
    throw new Error('Invalid credentials received from server');
  }

  // Create postgres connection URL
  const region = credentials.database.region.toLowerCase();
  const regionParts = region.split('_');
  const regionPrefix = `${regionParts[1]}-${regionParts[2]}-${regionParts[3]}`;  // e.g., us-west-2
  
  // Use custom host if provided, otherwise use default with region prefix
  const dbHost = options.dbHost ? 
    `${regionPrefix}.${options.dbHost}` : 
    `${regionPrefix}.db.thenile.dev`;

  // Create postgres client
  const client = new Client({
    host: dbHost,
    port: 5432,
    database: databaseName,
    user: credentials.id,
    password: credentials.password,
    ssl: {
      rejectUnauthorized: false
    }
  });

  if (options.debug) {
    console.log(theme.dim('\nConnecting to PostgreSQL:'));
    console.log(theme.dim('Host:'), dbHost);
    console.log(theme.dim('Database:'), databaseName);
    console.log(theme.dim('User:'), credentials.id);
    console.log();
  }

  // Connect to the database
  await client.connect();
  return client;
}

export class UsersCommand {
  constructor(program: Command, getGlobalOptions: () => GlobalOptions) {
    const users = program
      .command('users')
      .description('Manage users in your database')
      .addHelpText('after', `
Examples:
  # List users
  ${formatCommand('nile users list')}                                List all users
  ${formatCommand('nile users list', '--workspace myworkspace')}     List users in specific workspace
  ${formatCommand('nile users list', '--db mydb')}                  List users in specific database
  ${formatCommand('nile users list', '--format json')}              Output in JSON format
  ${formatCommand('nile users list', '--format csv')}               Output in CSV format

  # Create users
  ${formatCommand('nile users create', '--email "user@example.com" --password "password123"')}  Create user with email and password
  ${formatCommand('nile users create', '--email "user@example.com" --password "password123" --tenant tenant-123')}  Create user in specific tenant

  # Update users
  ${formatCommand('nile users update', '--id user-123 --new_email "new@example.com"')}     Update user email
  ${formatCommand('nile users update', '--id user-123 --new_password "newpassword123"')}   Update user password

  # Delete users
  ${formatCommand('nile users delete', '--id user-123')}                       Delete user by ID
  ${formatCommand('nile users delete', '--id 550e8400-e29b-41d4-a716-446655440000')}  Delete user by UUID

  # Using with different output formats
  ${formatCommand('nile users list', '--format json')}                     List users in JSON format
  ${formatCommand('nile users list', '--format csv')}                      List users in CSV format
  ${formatCommand('nile users create', '--email "user@example.com" --password "password123" --format json')}  Create user with JSON output

${getGlobalOptionsHelp()}`);

    const listCmd = new Command('list')
      .description('List all users in the database')
      .addHelpText('after', `
Examples:
  ${formatCommand('nile users list')}                                List all users
  ${formatCommand('nile users list', '--workspace myworkspace')}     List users in specific workspace
  ${formatCommand('nile users list', '--db mydb')}                  List users in specific database
      `)
      .action(async () => {
        let client: Client | undefined;
        try {
          const options = getGlobalOptions();
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

          const { workspaceSlug, databaseName } = await getWorkspaceAndDatabase(options);
          client = await getPostgresClient(api, workspaceSlug, databaseName, options);
          
          console.log(theme.dim('\nFetching users...'));
          const result = await client.query('SELECT * FROM users');
          const users = result.rows;
          
          if (users.length === 0) {
            console.log('No users found');
            return;
          }

          console.log('\nUsers:');
          const usersTable = new Table({
            head: [
              theme.header('ID'),
              theme.header('EMAIL'),
              theme.header('TENANT ID')
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

          users.forEach(user => {
            usersTable.push([
              theme.primary(user.id),
              theme.info(user.email),
              theme.secondary(user.tenant_id || '(none)')
            ]);
          });

          console.log(usersTable.toString());
        } catch (error: any) {
          if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
            await handleUserError(error, 'list users', new ConfigManager(getGlobalOptions()));
          } else {
            throw error;
          }
        } finally {
          if (client) {
            await client.end();
          }
        }
      });

    const createCmd = new Command('create')
      .description('Create a new user')
      .requiredOption('--email <email>', 'Email address of the user')
      .requiredOption('--password <password>', 'Password for the user')
      .option('--tenant <tenant>', 'Tenant ID to associate with the user')
      .addHelpText('after', `
Examples:
  ${formatCommand('nile users create', '--email "user@example.com" --password "password123"')}  Create a user with email and password
  ${formatCommand('nile users create', '--email "user@example.com" --password "password123" --tenant tenant-123')}  Create user in specific tenant
      `)
      .action(async (cmdOptions) => {
        let client: Client | undefined;
        try {
          const options = getGlobalOptions();
          const configManager = new ConfigManager(options);
          const api = new NileAPI({
            token: configManager.getToken(),
            dbHost: configManager.getDbHost(),
            controlPlaneUrl: configManager.getGlobalHost(),
          });
          const { workspaceSlug, databaseName } = await getWorkspaceAndDatabase(options);
          client = await getPostgresClient(api, workspaceSlug, databaseName, options);
          
          console.log(theme.dim(`\nCreating user with email: ${cmdOptions.email}`));
          const result = await client.query(
            'INSERT INTO users (email, password, tenant_id) VALUES ($1, $2, $3) RETURNING *',
            [cmdOptions.email, cmdOptions.password, cmdOptions.tenant]
          );
          
          const user = result.rows[0];
          console.log('\nUser created:');
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
            [theme.secondary('ID:'), theme.primary(user.id)],
            [theme.secondary('Email:'), theme.info(user.email)],
            [theme.secondary('Tenant ID:'), theme.secondary(user.tenant_id || '(none)')]
          );

          console.log(detailsTable.toString());
        } catch (error: any) {
          if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
            await handleUserError(error, 'create user', new ConfigManager(getGlobalOptions()));
          } else {
            throw error;
          }
        } finally {
          if (client) {
            await client.end();
          }
        }
      });

    const deleteCmd = new Command('delete')
      .description('Delete a user')
      .requiredOption('--id <id>', 'ID of the user to delete')
      .addHelpText('after', `
Examples:
  ${formatCommand('nile users delete', '--id user-123')}                Delete a user by ID
  ${formatCommand('nile users delete', '--id 550e8400-e29b-41d4-a716-446655440000')}  Delete user by UUID
      `)
      .action(async (cmdOptions) => {
        let client: Client | undefined;
        try {
          const options = getGlobalOptions();
          const configManager = new ConfigManager(options);
          const token = await configManager.getToken();
          const api = new NileAPI({
            token,
            dbHost: configManager.getDbHost(),
            controlPlaneUrl: configManager.getGlobalHost(),
          });
          const { workspaceSlug, databaseName } = await getWorkspaceAndDatabase(options);

          // First verify the user exists
          client = await getPostgresClient(api, workspaceSlug, databaseName, options);
          const checkResult = await client.query('SELECT id, email FROM users WHERE id = $1', [cmdOptions.id]);
          
          if (checkResult.rowCount === 0) {
            throw new Error(`User with ID '${cmdOptions.id}' not found`);
          }

          const user = checkResult.rows[0];
          console.log(theme.dim(`\nDeleting user '${user.email}' (${user.id})...`));
          
          // Delete the user
          await client.query('DELETE FROM users WHERE id = $1', [cmdOptions.id]);
          console.log(theme.success(`\nUser '${theme.bold(user.email)}' deleted successfully.`));
        } catch (error: any) {
          if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
            await handleUserError(error, 'delete user', new ConfigManager(getGlobalOptions()));
          } else {
            throw error;
          }
        } finally {
          if (client) {
            await client.end();
          }
        }
      });

    const updateCmd = new Command('update')
      .description('Update a user')
      .requiredOption('--id <id>', 'ID of the user to update')
      .option('--new_email <email>', 'New email address for the user')
      .option('--new_password <password>', 'New password for the user')
      .addHelpText('after', `
Examples:
  ${formatCommand('nile users update', '--id user-123 --new_email "new@example.com"')}  Update user email
  ${formatCommand('nile users update', '--id user-123 --new_password "newpassword123"')}  Update user password
      `)
      .action(async (cmdOptions) => {
        let client: Client | undefined;
        try {
          const options = getGlobalOptions();
          const configManager = new ConfigManager(options);
          const api = new NileAPI({
            token: configManager.getToken(),
            dbHost: configManager.getDbHost(),
            controlPlaneUrl: configManager.getGlobalHost(),
          });
          const { workspaceSlug, databaseName } = await getWorkspaceAndDatabase(options);

          console.log(theme.dim('\nUpdating user...'));
          client = await getPostgresClient(api, workspaceSlug, databaseName, options);
          
          // Build update query based on provided options
          const updates: string[] = [];
          const values: any[] = [];
          let paramCount = 1;

          if (cmdOptions.new_email) {
            updates.push(`email = $${paramCount}`);
            values.push(cmdOptions.new_email);
            paramCount++;
          }

          if (cmdOptions.new_password) {
            updates.push(`password = $${paramCount}`);
            values.push(cmdOptions.new_password);
            paramCount++;
          }

          if (updates.length === 0) {
            throw new Error('No update fields provided. Use --new_email or --new_password');
          }

          values.push(cmdOptions.id);
          const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
          
          const result = await client.query(query, values);

          if (result.rowCount === 0) {
            throw new Error(`User with ID '${cmdOptions.id}' not found`);
          }

          const user = result.rows[0];
          console.log(theme.success(`\nUser '${theme.bold(user.id)}' updated successfully.`));
          console.log(theme.primary('\nUpdated user details:'));
          console.log(`${theme.secondary('ID:')}   ${theme.primary(user.id)}`);
          console.log(`${theme.secondary('Email:')} ${theme.info(user.email)}`);
          console.log(`${theme.secondary('Tenant ID:')} ${theme.secondary(user.tenant_id || '(none)')}`);
        } catch (error: any) {
          if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
            await handleUserError(error, 'update user', new ConfigManager(getGlobalOptions()));
          } else {
            throw error;
          }
        } finally {
          if (client) {
            await client.end();
          }
        }
      });

    users.addCommand(listCmd);
    users.addCommand(createCmd);
    users.addCommand(deleteCmd);
    users.addCommand(updateCmd);
  }
}

export function createUsersCommand(getGlobalOptions: () => GlobalOptions): Command {
  const program = new Command();
  new UsersCommand(program, getGlobalOptions);
  return program.commands[0];
} 