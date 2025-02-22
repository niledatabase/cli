import { Command } from 'commander';
import { Client } from 'pg';
import { ConfigManager } from '../lib/config';
import { NileAPI } from '../lib/api';
import { theme, formatCommand } from '../lib/colors';
import { GlobalOptions, getGlobalOptionsHelp } from '../lib/globalOptions';
import Table from 'cli-table3';

async function getWorkspaceAndDatabase(options: GlobalOptions): Promise<{ workspaceSlug: string; databaseName: string }> {
  const configManager = new ConfigManager(options);
  const workspaceSlug = configManager.getWorkspace();
  if (!workspaceSlug) {
    throw new Error('No workspace specified. Use one of:\n' +
      '1. --workspace flag\n' +
      '2. nile config --workspace <name>\n' +
      '3. NILE_WORKSPACE environment variable');
  }

  const databaseName = configManager.getDatabase();
  if (!databaseName) {
    throw new Error('No database specified. Use one of:\n' +
      '1. --db flag\n' +
      '2. nile config --db <name>\n' +
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
  # Create users
  ${formatCommand('nile users create', '--email "user@example.com" --password "securepass123"')}     Create a basic user
  ${formatCommand('nile users create', '--email "user@example.com" --password "pass123" --name "John Doe"')}  Create user with name
  ${formatCommand('nile users create', '--email "user@example.com" --password "pass123" --given-name "John" --family-name "Doe"')}  Create user with full name
  ${formatCommand('nile users create', '--email "user@example.com" --password "pass123" --tenant-id "tenant123"')}  Create user in specific tenant
  ${formatCommand('nile users create', '--email "user@example.com" --password "pass123" --new-tenant-name "New Corp"')}  Create user with new tenant

  # List user tenants
  ${formatCommand('nile users tenants', '--user-id user123')}                List all tenants for a user

  # Update users
  ${formatCommand('nile users update', '--user-id user123 --name "Updated Name"')}  Update user name
  ${formatCommand('nile users update', '--user-id user123 --given-name "John" --family-name "Doe"')}  Update user full name

  # Remove user from tenant
  ${formatCommand('nile users remove-tenant', '--user-id user123 --tenant-id tenant123')}  Remove user from tenant

${getGlobalOptionsHelp()}`);

    const createCmd = new Command('create')
      .description('Create a new user')
      .requiredOption('--email <email>', 'Email address for the user')
      .requiredOption('--password <password>', 'Password for the user')
      .option('--name <n>', 'Full name of the user')
      .option('--given-name <n>', 'Given (first) name of the user')
      .option('--family-name <n>', 'Family (last) name of the user')
      .option('--picture <url>', 'URL of the user\'s profile picture')
      .option('--tenant-id <id>', 'ID of the tenant to add the user to')
      .option('--new-tenant-name <n>', 'Name of a new tenant to create and add the user to')
      .option('--roles <roles...>', 'Roles to assign to the user in the tenant')
      .addHelpText('after', `
Examples:
  ${formatCommand('nile users create', '--email "user@example.com" --password "securepass123"')}
  ${formatCommand('nile users create', '--email "user@example.com" --password "pass123" --name "John Doe"')}
  ${formatCommand('nile users create', '--email "user@example.com" --password "pass123" --tenant-id "tenant123"')}
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
            debug: options.debug
          });

          const { workspaceSlug, databaseName } = await getWorkspaceAndDatabase(options);
          client = await getPostgresClient(api, workspaceSlug, databaseName, options);

          // Begin transaction
          await client.query('BEGIN');

          try {
            // Insert into users schema
            console.log(theme.dim('\nCreating user...'));
            const result = await client.query(
              `INSERT INTO users.users (
                email,
                name,
                given_name,
                family_name,
                picture
              ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
              [
                cmdOptions.email,
                cmdOptions.name || null,
                cmdOptions.givenName || null,
                cmdOptions.familyName || null,
                cmdOptions.picture || null
              ]
            );

            const user = result.rows[0];

            // Create auth credentials (this would typically be handled by auth service)
            await client.query(
              `INSERT INTO auth.credentials (
                user_id,
                identifier,
                password,
                type
              ) VALUES ($1, $2, crypt($3, gen_salt('bf')), 'password')`,
              [user.id, cmdOptions.email, cmdOptions.password]
            );

            // If tenant ID is provided, create user-tenant relationship
            if (cmdOptions.tenantId) {
              await client.query(
                `INSERT INTO users.tenant_users (
                  tenant_id,
                  user_id,
                  roles,
                  email
                ) VALUES ($1, $2, $3, $4)`,
                [cmdOptions.tenantId, user.id, cmdOptions.roles || null, cmdOptions.email]
              );
            }

            // If new tenant name is provided, create tenant and relationship
            if (cmdOptions.newTenantName) {
              const tenantResult = await client.query(
                'INSERT INTO tenants (name) VALUES ($1) RETURNING id',
                [cmdOptions.newTenantName]
              );
              const tenantId = tenantResult.rows[0].id;
              await client.query(
                `INSERT INTO users.tenant_users (
                  tenant_id,
                  user_id,
                  roles,
                  email
                ) VALUES ($1, $2, $3, $4)`,
                [tenantId, user.id, cmdOptions.roles || null, cmdOptions.email]
              );
            }

            // Commit transaction
            await client.query('COMMIT');

            if (options.format === 'json') {
              console.log(JSON.stringify(user, null, 2));
              return;
            }

            if (options.format === 'csv') {
              console.log('ID,EMAIL,NAME');
              console.log(`${user.id},${user.email},${user.name || ''}`);
              return;
            }

            // Create a nicely formatted table
            const table = new Table({
              head: ['Field', 'Value'].map(h => theme.primary(h)),
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

            table.push(
              ['ID', theme.info(user.id)],
              ['Email', theme.info(user.email)],
              ['Name', theme.info(user.name || '')],
              ['Given Name', theme.info(user.given_name || '')],
              ['Family Name', theme.info(user.family_name || '')],
              ['Picture', theme.info(user.picture || '')]
            );

            console.log('\nUser created successfully:');
            console.log(table.toString());

            if (cmdOptions.tenantId) {
              console.log(theme.success(`\nUser added to tenant: ${cmdOptions.tenantId}`));
            } else if (cmdOptions.newTenantName) {
              console.log(theme.success(`\nUser added to new tenant: ${cmdOptions.newTenantName}`));
            }
          } catch (error) {
            // Rollback transaction on error
            await client.query('ROLLBACK');
            throw error;
          }
        } catch (error: any) {
          const options = getGlobalOptions();
          if (options.debug) {
            console.error(theme.error('Failed to create user:'), error);
          } else {
            console.error(theme.error('Failed to create user:'), error.message || 'Unknown error');
          }
          process.exit(1);
        } finally {
          if (client) {
            await client.end();
          }
        }
      });

    const tenantsCmd = new Command('tenants')
      .description('List tenants for a user')
      .requiredOption('--user-id <id>', 'ID of the user')
      .addHelpText('after', `
Examples:
  ${formatCommand('nile users tenants', '--user-id user123')}  List all tenants for a user
      `)
      .action(async (cmdOptions) => {
        try {
          const options = getGlobalOptions();
          const configManager = new ConfigManager(options);
          const api = new NileAPI({
            token: configManager.getToken(),
            dbHost: configManager.getDbHost(),
            controlPlaneUrl: configManager.getGlobalHost(),
            debug: options.debug
          });

          const { workspaceSlug, databaseName } = await getWorkspaceAndDatabase(options);
          const databaseId = await api.getDatabaseId(workspaceSlug, databaseName);

          const tenants = await api.getUserTenants(databaseId, cmdOptions.userId);

          if (options.format === 'json') {
            console.log(JSON.stringify(tenants, null, 2));
            return;
          }

          if (options.format === 'csv') {
            console.log('ID,NAME');
            tenants.forEach(tenant => {
              console.log(`${tenant.id},${tenant.name || ''}`);
            });
            return;
          }

          if (tenants.length === 0) {
            console.log(theme.warning('\nNo tenants found for this user.'));
            return;
          }

          console.log('\nUser Tenants:');
          const table = new Table({
            head: [
              theme.header('ID'),
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

          tenants.forEach(tenant => {
            table.push([
              theme.primary(tenant.id),
              theme.info(tenant.name || '(unnamed)')
            ]);
          });

          console.log(table.toString());
        } catch (error: any) {
          const options = getGlobalOptions();
          if (options.debug) {
            console.error(theme.error('Failed to list user tenants:'), error);
          } else {
            console.error(theme.error('Failed to list user tenants:'), error.message || 'Unknown error');
          }
          process.exit(1);
        }
      });

    const updateCmd = new Command('update')
      .description('Update user details')
      .requiredOption('--user-id <id>', 'ID of the user to update')
      .option('--name <n>', 'Full name of the user')
      .option('--given-name <n>', 'Given (first) name of the user')
      .option('--family-name <n>', 'Family (last) name of the user')
      .option('--picture <url>', 'URL of the user\'s profile picture')
      .addHelpText('after', `
Examples:
  ${formatCommand('nile users update', '--user-id user123 --name "Updated Name"')}
  ${formatCommand('nile users update', '--user-id user123 --given-name "John" --family-name "Doe"')}
      `)
      .action(async (cmdOptions) => {
        try {
          const options = getGlobalOptions();
          const configManager = new ConfigManager(options);
          const api = new NileAPI({
            token: configManager.getToken(),
            dbHost: configManager.getDbHost(),
            controlPlaneUrl: configManager.getGlobalHost(),
            debug: options.debug
          });

          const { workspaceSlug, databaseName } = await getWorkspaceAndDatabase(options);
          const databaseId = await api.getDatabaseId(workspaceSlug, databaseName);

          const updates = {
            name: cmdOptions.name,
            givenName: cmdOptions.givenName,
            familyName: cmdOptions.familyName,
            picture: cmdOptions.picture
          };

          const user = await api.updateUser(databaseId, cmdOptions.userId, updates);

          if (options.format === 'json') {
            console.log(JSON.stringify(user, null, 2));
            return;
          }

          if (options.format === 'csv') {
            console.log('ID,EMAIL,NAME');
            console.log(`${user.id},${user.email},${user.name || ''}`);
            return;
          }

          console.log('\nUser updated successfully:');
          const table = new Table({
            head: ['Field', 'Value'].map(h => theme.primary(h)),
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

          table.push(
            ['ID', theme.info(user.id)],
            ['Email', theme.info(user.email)],
            ['Name', theme.info(user.name || '')],
            ['Given Name', theme.info(user.givenName || '')],
            ['Family Name', theme.info(user.familyName || '')],
            ['Picture', theme.info(user.picture || '')]
          );

          console.log(table.toString());
        } catch (error: any) {
          const options = getGlobalOptions();
          if (options.debug) {
            console.error(theme.error('Failed to update user:'), error);
          } else {
            console.error(theme.error('Failed to update user:'), error.message || 'Unknown error');
          }
          process.exit(1);
        }
      });

    const removeTenantCmd = new Command('remove-tenant')
      .description('Remove a user from a tenant')
      .requiredOption('--user-id <id>', 'ID of the user')
      .requiredOption('--tenant-id <id>', 'ID of the tenant')
      .addHelpText('after', `
Examples:
  ${formatCommand('nile users remove-tenant', '--user-id user123 --tenant-id tenant123')}
      `)
      .action(async (cmdOptions) => {
        try {
          const options = getGlobalOptions();
          const configManager = new ConfigManager(options);
          const api = new NileAPI({
            token: configManager.getToken(),
            dbHost: configManager.getDbHost(),
            controlPlaneUrl: configManager.getGlobalHost(),
            debug: options.debug
          });

          const { workspaceSlug, databaseName } = await getWorkspaceAndDatabase(options);
          const databaseId = await api.getDatabaseId(workspaceSlug, databaseName);

          await api.removeUserFromTenant(databaseId, cmdOptions.userId, cmdOptions.tenantId);
          console.log(theme.success(`\nUser '${cmdOptions.userId}' removed from tenant '${cmdOptions.tenantId}'`));
        } catch (error: any) {
          const options = getGlobalOptions();
          if (options.debug) {
            console.error(theme.error('Failed to remove user from tenant:'), error);
          } else {
            console.error(theme.error('Failed to remove user from tenant:'), error.message || 'Unknown error');
          }
          process.exit(1);
        }
      });

    users.addCommand(createCmd);
    users.addCommand(tenantsCmd);
    users.addCommand(updateCmd);
    users.addCommand(removeTenantCmd);
  }
}

export function createUsersCommand(getGlobalOptions: () => GlobalOptions): Command {
  const program = new Command();
  new UsersCommand(program, getGlobalOptions);
  return program.commands[0];
} 