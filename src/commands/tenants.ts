import { Command } from 'commander';
import { Client } from 'pg';
import { ConfigManager } from '../lib/config';
import { NileAPI } from '../lib/api';
import { theme, table, formatCommand } from '../lib/colors';
import { GlobalOptions, getGlobalOptionsHelp } from '../lib/globalOptions';

async function getWorkspaceAndDatabase(options: GlobalOptions): Promise<{ workspaceSlug: string; databaseName: string }> {
    const configManager = new ConfigManager();
    const workspaceSlug = configManager.getWorkspace(options);
    if (!workspaceSlug) {
        throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <name>\n' +
            '3. NILE_WORKSPACE environment variable');
    }

    const databaseName = configManager.getDatabase(options);
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
  ${formatCommand('nile tenants list')}                                List all tenants
  ${formatCommand('nile tenants list', '--workspace myworkspace --db mydb')}  List tenants with explicit workspace/db
  ${formatCommand('nile tenants create', '--name "My Tenant"')}              Create a tenant
  ${formatCommand('nile tenants create', '--name "My Tenant" --id custom-uuid')}  Create tenant with custom ID
  ${formatCommand('nile tenants update', 'tenant-id --name "New Name"')}     Update tenant name
  ${formatCommand('nile tenants delete', 'tenant-id')}                       Delete a tenant
  ${formatCommand('nile tenants list', '--format json')}                     Output in JSON format

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
          const configManager = new ConfigManager();
          configManager.initializeWithOptions(options);
          const token = await configManager.getToken();
          const api = new NileAPI({
            token: configManager.getToken(),
            dbHost: configManager.getDbHost(options),
            controlPlaneUrl: configManager.getGlobalHost(options),
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
          tenants.forEach(tenant => {
            console.log(`${theme.dim('ID:')} ${tenant.id}`);
            console.log(`${theme.dim('Name:')} ${tenant.name || '(unnamed)'}`);
            console.log();
          });
        } catch (error: any) {
          console.error(theme.error('Failed to list tenants:'), error.message || error);
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
          const configManager = new ConfigManager();
          configManager.initializeWithOptions(options);
          const api = new NileAPI({
            token: configManager.getToken(),
            dbHost: configManager.getDbHost(options),
            controlPlaneUrl: configManager.getGlobalHost(options),
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
          console.log(`${theme.dim('ID:')} ${tenant.id}`);
          console.log(`${theme.dim('Name:')} ${tenant.name}`);
        } catch (error: any) {
          console.error(theme.error('Failed to create tenant:'), error.message || error);
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
          const configManager = new ConfigManager();
          configManager.initializeWithOptions(options);
          const token = await configManager.getToken();
          const api = new NileAPI({
            token,
            dbHost: configManager.getDbHost(options),
            controlPlaneUrl: configManager.getGlobalHost(options),
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
        } catch (error) {
          if (error instanceof Error) {
            console.error(theme.error('\nFailed to delete tenant:'), error.message);
          } else {
            console.error(theme.error('\nFailed to delete tenant:'), error);
          }
          process.exit(1);
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
          const configManager = new ConfigManager();
          configManager.initializeWithOptions(options);
          const api = new NileAPI({
            token: configManager.getToken(),
            dbHost: configManager.getDbHost(options),
            controlPlaneUrl: configManager.getGlobalHost(options),
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
        } catch (error) {
          if (error instanceof Error) {
            console.error(theme.error('\nFailed to update tenant:'), error.message);
          } else {
            console.error(theme.error('\nFailed to update tenant:'), error);
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