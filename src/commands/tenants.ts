import { Command } from 'commander';
import { Config } from '../lib/config';
import { NileAPI } from '../lib/api';
import { getAuthToken } from '../lib/authUtils';
import { theme, table, formatCommand } from '../lib/colors';

interface GlobalOptions {
  apiKey?: string;
  format?: 'human' | 'json' | 'csv';
  color?: boolean;
  debug?: boolean;
  dbHost?: string;
  apiHost?: string;
}

type GetOptions = () => GlobalOptions;

async function getWorkspaceAndDatabase(options: any): Promise<{ workspace: string; database: string }> {
  // Try to get workspace from options or config
  let workspaceSlug = options.workspace;
  if (!workspaceSlug) {
    const workspace = await Config.getWorkspace();
    if (!workspace?.slug) {
      throw new Error(
        'No workspace specified. You can either:\n' +
        '  1. Run "nile workspace select <workspace>" to set a default workspace\n' +
        '  2. Use the --workspace flag with your command:\n' +
        '     nile tenants list --workspace <workspace>'
      );
    }
    workspaceSlug = workspace.slug;
  }

  // Try to get database from options or config
  let databaseName = options.db;
  if (!databaseName) {
    const database = await Config.getDatabase();
    if (!database?.name) {
      throw new Error(
        'No database specified. You can either:\n' +
        '  1. Run "nile db select <database>" to set a default database\n' +
        '  2. Use the --db flag with your command:\n' +
        '     nile tenants list --db <database>'
      );
    }
    databaseName = database.name;
  }

  return { workspace: workspaceSlug, database: databaseName };
}

export function createTenantsCommand(getOptions: GetOptions): Command {
  const tenants = new Command('tenants')
    .description('Manage tenants in your Nile database')
    .option('--workspace <name>', 'Workspace name (required if workspace is not selected)')
    .option('--db <name>', 'Database name (required if database is not selected)')
    .addHelpText('after', `
Global Options:
  --api-key <key>     API key for authentication
  --api-host <host>   Override API host (default: api.thenile.dev)
  --format <type>     Output format: human (default), json, or csv
  --color [boolean]   Enable/disable colored output
  --debug            Enable debug output

Commands:
  list               List all tenants in the database
  create             Create a new tenant
  update             Update an existing tenant
  delete             Delete a tenant

Examples:
  # List tenants (using selected workspace and database)
  ${formatCommand('nile tenants list')}
  
  # List tenants with explicit workspace and database
  ${formatCommand('nile tenants list', '--workspace myworkspace --db mydb')}
  
  # Create a tenant
  ${formatCommand('nile tenants create', '--name "My Tenant"')}
  
  # Create a tenant with custom UUID
  ${formatCommand('nile tenants create', '--name "My Tenant" --id custom-uuid')}
  
  # Update tenant name
  ${formatCommand('nile tenants update', 'tenant-id --name "New Name"')}
  
  # Delete a tenant
  ${formatCommand('nile tenants delete', 'tenant-id')}
  
  # Output in JSON format
  ${formatCommand('nile tenants list', '--format json')}`);

  tenants
    .command('list')
    .description('List all tenants in the database')
    .action(async (options) => {
      try {
        // Get both command-specific and parent options
        const allOptions = { ...options, ...tenants.opts() };
        const { workspace, database } = await getWorkspaceAndDatabase(allOptions);
        const globalOptions = getOptions();
        const token = await getAuthToken(globalOptions);
        const api = new NileAPI(token, globalOptions.debug);

        console.log(theme.dim('\nFetching tenants...'));
        const tenantList = await api.listTenants(workspace, database);

        if (globalOptions.format === 'json') {
          console.log(JSON.stringify(tenantList, null, 2));
          return;
        }

        if (globalOptions.format === 'csv') {
          console.log('ID,NAME');
          tenantList.forEach((tenant) => {
            console.log(`${tenant.id},${tenant.name || ''}`);
          });
          return;
        }

        if (tenantList.length === 0) {
          console.log(theme.warning('\nNo tenants found.'));
          return;
        }

        // Create a nicely formatted table
        console.log(theme.primary('\nTenants:'));
        
        const header = `${table.topLeft}${'─'.repeat(38)}${table.cross}${'─'.repeat(30)}${table.topRight}`;
        console.log(header);
        console.log(`${table.vertical}${theme.header(' ID').padEnd(38)}${table.vertical}${theme.header(' NAME').padEnd(30)}${table.vertical}`);
        console.log(`${table.vertical}${theme.border('─'.repeat(37))}${table.vertical}${theme.border('─'.repeat(29))}${table.vertical}`);

        tenantList.forEach((tenant) => {
          console.log(
            `${table.vertical} ${theme.primary(tenant.id.padEnd(36))}${table.vertical} ${theme.info((tenant.name || '').padEnd(28))}${table.vertical}`
          );
        });

        console.log(`${table.bottomLeft}${'─'.repeat(38)}${table.cross}${'─'.repeat(30)}${table.bottomRight}`);
      } catch (error) {
        if (error instanceof Error) {
          console.error(theme.error('\nFailed to list tenants:'), error.message);
        } else {
          console.error(theme.error('\nFailed to list tenants:'), error);
        }
        process.exit(1);
      }
    });

  tenants
    .command('create')
    .description('Create a new tenant')
    .requiredOption('--name <name>', 'Name of the tenant')
    .option('--id <id>', 'Optional UUID for the tenant')
    .action(async (options) => {
      try {
        // Get both command-specific and parent options
        const allOptions = { ...options, ...tenants.opts() };
        const { workspace, database } = await getWorkspaceAndDatabase(allOptions);
        const globalOptions = getOptions();
        const token = await getAuthToken(globalOptions);
        const api = new NileAPI(token, globalOptions.debug);

        console.log(theme.dim('\nCreating tenant...'));
        const tenant = await api.createTenant(workspace, database, {
          name: options.name,
          id: options.id
        });

        console.log(theme.success(`\nTenant created successfully with ID: ${theme.bold(tenant.id)}`));
        console.log(theme.primary('\nTenant details:'));
        console.log(`${theme.secondary('ID:')}   ${theme.primary(tenant.id)}`);
        console.log(`${theme.secondary('Name:')} ${theme.info(tenant.name)}`);
      } catch (error) {
        if (error instanceof Error) {
          console.error(theme.error('\nFailed to create tenant:'), error.message);
        } else {
          console.error(theme.error('\nFailed to create tenant:'), error);
        }
        process.exit(1);
      }
    });

  tenants
    .command('delete <tenantId>')
    .description('Delete a tenant')
    .action(async (tenantId, options) => {
      try {
        // Get both command-specific and parent options
        const allOptions = { ...options, ...tenants.opts() };
        const { workspace, database } = await getWorkspaceAndDatabase(allOptions);
        const globalOptions = getOptions();
        const token = await getAuthToken(globalOptions);
        const api = new NileAPI(token, globalOptions.debug);

        console.log(theme.dim('\nDeleting tenant...'));
        await api.deleteTenant(workspace, database, tenantId);
        console.log(theme.success(`\nTenant '${theme.bold(tenantId)}' deleted successfully.`));
      } catch (error) {
        if (error instanceof Error) {
          console.error(theme.error('\nFailed to delete tenant:'), error.message);
        } else {
          console.error(theme.error('\nFailed to delete tenant:'), error);
        }
        process.exit(1);
      }
    });

  tenants
    .command('update <tenantId>')
    .description('Update a tenant')
    .requiredOption('--name <name>', 'New name for the tenant')
    .action(async (tenantId, options) => {
      try {
        // Get both command-specific and parent options
        const allOptions = { ...options, ...tenants.opts() };
        const { workspace, database } = await getWorkspaceAndDatabase(allOptions);
        const globalOptions = getOptions();
        const token = await getAuthToken(globalOptions);
        const api = new NileAPI(token, globalOptions.debug);

        console.log(theme.dim('\nUpdating tenant...'));
        const tenant = await api.updateTenant(workspace, database, tenantId, {
          name: options.name
        });

        console.log(theme.success(`\nTenant '${theme.bold(tenantId)}' updated successfully.`));
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
      }
    });

  return tenants;
} 