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

export class TenantsCommand {
  constructor(program: Command, getGlobalOptions: () => GlobalOptions) {
    const tenants = program
      .command('tenants')
      .description('Manage tenants in your database')
      .addHelpText('after', `
Examples:
  # List tenants
  ${formatCommand('nile tenants list')}                                List all tenants
  ${formatCommand('nile tenants list', '--workspace myworkspace')}     List tenants in specific workspace
  ${formatCommand('nile tenants list', '--db mydb')}                  List tenants in specific database
  ${formatCommand('nile tenants list', '--format json')}              Output in JSON format
  ${formatCommand('nile tenants list', '--format csv')}               Output in CSV format

  # Create tenants
  ${formatCommand('nile tenants create', '--name "My Tenant"')}              Create tenant with auto-generated ID
  ${formatCommand('nile tenants create', '--name "My Tenant" --id custom-id')}  Create tenant with custom ID
  ${formatCommand('nile tenants create', '--name "Customer A"')}             Create tenant for a customer
  ${formatCommand('nile tenants create', '--name "Organization B" --id org-b')}  Create tenant with organization ID

  # Update tenants
  ${formatCommand('nile tenants update', '--id tenant-123 --new_name "New Name"')}     Update tenant name
  ${formatCommand('nile tenants update', '--id org-b --new_name "Organization B Ltd"')} Update organization name
  ${formatCommand('nile tenants update', '--id custom-id --new_name "Updated Name"')}   Update custom tenant name

  # Delete tenants
  ${formatCommand('nile tenants delete', '--id tenant-123')}                       Delete tenant by ID
  ${formatCommand('nile tenants delete', '--id org-b')}                           Delete organization tenant
  ${formatCommand('nile tenants delete', '--id 550e8400-e29b-41d4-a716-446655440000')}  Delete tenant by UUID

  # Using with different output formats
  ${formatCommand('nile tenants list', '--format json')}                     List tenants in JSON format
  ${formatCommand('nile tenants list', '--format csv')}                      List tenants in CSV format
  ${formatCommand('nile tenants create', '--name "New Tenant" --format json')}  Create tenant with JSON output

${getGlobalOptionsHelp()}`);

    const listCmd = new Command('list')
      .description('List all tenants in the database')
      .addHelpText('after', `
Examples:
  ${formatCommand('nile tenants list')}                                List all tenants
  ${formatCommand('nile tenants list', '--workspace myworkspace')}     List tenants in specific workspace
  ${formatCommand('nile tenants list', '--db mydb')}                  List tenants in specific database
      `)
      .action(async () => {
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
          
          console.log(theme.dim('\nFetching tenants...'));
          const result = await client.query('SELECT * FROM tenants');
          const tenants = result.rows;
          
          if (tenants.length === 0) {
            console.log('No tenants found');
            return;
          }

          console.log('\nTenants:');
          const tenantsTable = new Table({
            head: [
              theme.header('ID'),
              theme.header('NAME')
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

          tenants.forEach(tenant => {
            tenantsTable.push([
              theme.primary(tenant.id),
              theme.info(tenant.name || '(unnamed)')
            ]);
          });

          console.log(tenantsTable.toString());
        } catch (error: any) {
          const options = getGlobalOptions();
          if (options.debug) {
            console.error(theme.error('Failed to list tenants:'), error);
          } else {
            console.error(theme.error('Failed to list tenants:'), error.message || 'Unknown error');
          }
          process.exit(1);
        } finally {
          if (client) {
            await client.end();
          }
        }
      });

    const createCmd = new Command('create')
      .description('Create a new tenant')
      .requiredOption('--name <name>', 'Name of the tenant')
      .option('--id <id>', 'Optional UUID for the tenant')
      .addHelpText('after', `
Examples:
  ${formatCommand('nile tenants create', '--name "My Tenant"')}              Create a tenant with auto-generated ID
  ${formatCommand('nile tenants create', '--name "My Tenant" --id custom-id')}  Create tenant with custom ID
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
          
          console.log(theme.dim(`\nCreating tenant...with name: ${cmdOptions.name} and id: ${cmdOptions.id}`));
          let result;
          if (cmdOptions.id) {
            result = await client.query(
              'INSERT INTO tenants (id, name) VALUES ($1, $2) RETURNING *',
              [cmdOptions.id, cmdOptions.name]
            );
          } else {
            result = await client.query(
              'INSERT INTO tenants (name) VALUES ($1) RETURNING *',
              [cmdOptions.name]
            );
          }
          
          const tenant = result.rows[0];
          console.log('\nTenant created:');
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
            [theme.secondary('ID:'), theme.primary(tenant.id)],
            [theme.secondary('Name:'), theme.info(tenant.name)]
          );

          console.log(detailsTable.toString());
        } catch (error: any) {
          const options = getGlobalOptions();
          if (options.debug) {
            console.error(theme.error('Failed to create tenant:'), error);
          } else {
            console.error(theme.error('Failed to create tenant:'), error.message || 'Unknown error');
          }
          process.exit(1);
        } finally {
          if (client) {
            await client.end();
          }
        }
      });

    const deleteCmd = new Command('delete')
      .description('Delete a tenant')
      .requiredOption('--id <id>', 'ID of the tenant to delete')
      .addHelpText('after', `
Examples:
  ${formatCommand('nile tenants delete', '--id tenant-123')}                Delete a tenant by ID
  ${formatCommand('nile tenants delete', '--id 550e8400-e29b-41d4-a716-446655440000')}  Delete tenant by UUID
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

          // First verify the tenant exists
          client = await getPostgresClient(api, workspaceSlug, databaseName, options);
          const checkResult = await client.query('SELECT id, name FROM tenants WHERE id = $1', [cmdOptions.id]);
          
          if (checkResult.rowCount === 0) {
            throw new Error(`Tenant with ID '${cmdOptions.id}' not found`);
          }

          const tenant = checkResult.rows[0];
          console.log(theme.dim(`\nDeleting tenant '${tenant.name}' (${tenant.id})...`));
          
          // Delete the tenant
          await client.query('DELETE FROM tenants WHERE id = $1', [cmdOptions.id]);
          console.log(theme.success(`\nTenant '${theme.bold(tenant.name)}' deleted successfully.`));
        } catch (error: any) {
          const options = getGlobalOptions();
          if (options.debug) {
            console.error(theme.error('\nFailed to delete tenant:'), error);
          } else {
            console.error(theme.error('\nFailed to delete tenant:'), error instanceof Error ? error.message : 'Unknown error');
          }
          process.exit(1);
        } finally {
          if (client) {
            await client.end();
          }
        }
      });

    const updateCmd = new Command('update')
      .description('Update a tenant')
      .requiredOption('--id <id>', 'ID of the tenant to update')
      .requiredOption('--new_name <name>', 'New name for the tenant')
      .addHelpText('after', `
Examples:
  ${formatCommand('nile tenants update', '--id tenant-123 --new_name "New Name"')}  Update tenant name
  ${formatCommand('nile tenants update', '--id 550e8400-e29b-41d4-a716-446655440000 --new_name "New Name"')}  Update tenant with UUID
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

          console.log(theme.dim('\nUpdating tenant...'));
          client = await getPostgresClient(api, workspaceSlug, databaseName, options);
          const result = await client.query(
            'UPDATE tenants SET name = $1 WHERE id = $2 RETURNING *',
            [cmdOptions.new_name, cmdOptions.id]
          );

          if (result.rowCount === 0) {
            throw new Error(`Tenant with ID '${cmdOptions.id}' not found`);
          }

          const tenant = result.rows[0];
          console.log(theme.success(`\nTenant '${theme.bold(tenant.id)}' updated successfully.`));
          console.log(theme.primary('\nUpdated tenant details:'));
          console.log(`${theme.secondary('ID:')}   ${theme.primary(tenant.id)}`);
          console.log(`${theme.secondary('Name:')} ${theme.info(tenant.name)}`);
        } catch (error: any) {
          const options = getGlobalOptions();
          if (options.debug) {
            console.error(theme.error('\nFailed to update tenant:'), error);
          } else {
            console.error(theme.error('\nFailed to update tenant:'), error instanceof Error ? error.message : 'Unknown error');
          }
          process.exit(1);
        } finally {
          if (client) {
            await client.end();
          }
        }
      });

    tenants.addCommand(listCmd);
    tenants.addCommand(createCmd);
    tenants.addCommand(deleteCmd);
    tenants.addCommand(updateCmd);
  }
}

export function createTenantsCommand(getGlobalOptions: () => GlobalOptions): Command {
  const program = new Command();
  new TenantsCommand(program, getGlobalOptions);
  return program.commands[0];
} 