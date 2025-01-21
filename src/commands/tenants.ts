import { Command } from 'commander';
import postgres from 'postgres';
import { Config } from '../lib/config';
import { NileAPI } from '../lib/api';
import { theme, table, formatCommand } from '../lib/colors';
import { GlobalOptions, getGlobalOptionsHelp } from '../lib/globalOptions';
import { getAuthToken } from '../lib/authUtils';

async function getWorkspaceAndDatabase(options: GlobalOptions): Promise<{ workspaceSlug: string; databaseName: string }> {
  const workspaceSlug = options.workspace || (await Config.getWorkspace())?.slug;
  if (!workspaceSlug) {
    throw new Error('No workspace specified. Please run "nile workspace select" first or use --workspace flag');
  }

  const databaseName = options.db || (await Config.getDatabase())?.name;
  if (!databaseName) {
    throw new Error('No database specified. Please run "nile db select" first or use --db flag');
  }

  return { workspaceSlug, databaseName };
}

async function getPostgresClient(api: NileAPI, workspaceSlug: string, databaseName: string, options: GlobalOptions): Promise<postgres.Sql<{}>> {
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

  const connectionString = `postgres://${credentials.id}:${credentials.password}@${dbHost}:5432/${databaseName}`;

  if (options.debug) {
    console.log(theme.dim('\nConnecting to PostgreSQL:'));
    console.log(theme.dim('Host:'), dbHost);
    console.log(theme.dim('Database:'), databaseName);
    console.log(theme.dim('User:'), credentials.id);
    console.log();
  }

  // Create postgres client with SSL configuration to accept self-signed certificates
  return postgres(connectionString, {
    ssl: {
      rejectUnauthorized: false
    },
    prepare: false,  // Disable prepared statements to avoid connection issues
    debug: (connection_id, query, params, types) => {
      console.log(theme.dim('\nPostgres Query:'));
      console.log(theme.dim('Query:'), query);
      console.log(theme.dim('Parameters:'), params);
    }
  });
}

export function createTenantsCommand(getGlobalOptions: () => GlobalOptions): Command {
  const tenants = new Command('tenants')
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

  tenants
    .command('list')
    .description('List all tenants in the database')
    .action(async () => {
      let sql: postgres.Sql<{}> | undefined;
      try {
        const options = getGlobalOptions();
        const { workspaceSlug, databaseName } = await getWorkspaceAndDatabase(options);
        const api = new NileAPI({
          token: await getAuthToken(options),
          debug: options.debug,
          controlPlaneUrl: options.globalHost,
          dbHost: options.dbHost
        });

        sql = await getPostgresClient(api, workspaceSlug, databaseName, options);
        
        console.log(theme.dim('\nFetching tenants...'));
        const tenants = await sql`SELECT * FROM tenants`;
        
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
        if (sql) {
          await sql.end();
        }
      }
    });

  tenants
    .command('create')
    .description('Create a new tenant')
    .requiredOption('--name <name>', 'Name of the tenant')
    .option('--id <id>', 'Optional UUID for the tenant')
    .action(async (cmdOptions) => {
      let sql: postgres.Sql<{}> | undefined;
      try {
        const options = getGlobalOptions();
        const { workspaceSlug, databaseName } = await getWorkspaceAndDatabase(options);
        const api = new NileAPI({
          token: await getAuthToken(options),
          debug: options.debug,
          controlPlaneUrl: options.globalHost,
          dbHost: options.dbHost
        });

        sql = await getPostgresClient(api, workspaceSlug, databaseName, options);
        
        console.log(theme.dim(`\nCreating tenant...with name: ${cmdOptions.name} and id: ${cmdOptions.id}`));
        let tenant;
        if (cmdOptions.id) {
          tenant = await sql`
            INSERT INTO tenants 
            (id, name) 
            VALUES 
            (${cmdOptions.id}, ${cmdOptions.name}) 
            RETURNING *
          `;
        } else {
          tenant = await sql`
            INSERT INTO tenants 
            (name) 
            VALUES 
            (${cmdOptions.name}) 
            RETURNING *
          `;
        }
        
        console.log('\nTenant created:');
        console.log(`${theme.dim('ID:')} ${tenant[0].id}`);
        console.log(`${theme.dim('Name:')} ${tenant[0].name}`);
      } catch (error: any) {
        console.error(theme.error('Failed to create tenant:'), error.message || error);
        process.exit(1);
      } finally {
        if (sql) {
          await sql.end();
        }
      }
    });

  tenants
    .command('delete <tenantId>')
    .description('Delete a tenant')
    .action(async (tenantId, options) => {
      let sql: postgres.Sql<{}> | undefined;
      try {
        // Get both command-specific and parent options
        const allOptions = { ...options, ...tenants.opts() };
        const { workspaceSlug, databaseName } = await getWorkspaceAndDatabase(allOptions);
        const globalOptions = getGlobalOptions();
        const api = new NileAPI({
          token: await getAuthToken(globalOptions),
          debug: globalOptions.debug,
          controlPlaneUrl: globalOptions.globalHost,
          dbHost: globalOptions.dbHost
        });

        console.log(theme.dim('\nDeleting tenant...'));
        sql = await getPostgresClient(api, workspaceSlug, databaseName, globalOptions);
        await sql`DELETE FROM tenants WHERE id = ${tenantId}`;
        console.log(theme.success(`\nTenant '${theme.bold(tenantId)}' deleted successfully.`));
      } catch (error) {
        if (error instanceof Error) {
          console.error(theme.error('\nFailed to delete tenant:'), error.message);
        } else {
          console.error(theme.error('\nFailed to delete tenant:'), error);
        }
        process.exit(1);
      } finally {
        if (sql) {
          await sql.end();
        }
      }
    });

  tenants
    .command('update <tenantId>')
    .description('Update a tenant')
    .requiredOption('--name <name>', 'New name for the tenant')
    .action(async (tenantId, options) => {
      let sql: postgres.Sql<{}> | undefined;
      try {
        // Get both command-specific and parent options
        const allOptions = { ...options, ...tenants.opts() };
        const { workspaceSlug, databaseName } = await getWorkspaceAndDatabase(allOptions);
        const globalOptions = getGlobalOptions();
        const api = new NileAPI({
          token: await getAuthToken(globalOptions),
          debug: globalOptions.debug,
          controlPlaneUrl: globalOptions.globalHost,
          dbHost: globalOptions.dbHost
        });

        console.log(theme.dim('\nUpdating tenant...'));
        sql = await getPostgresClient(api, workspaceSlug, databaseName, globalOptions);
        const tenant = await sql`UPDATE tenants SET name = ${options.name} WHERE id = ${tenantId} RETURNING *`;

        console.log(theme.success(`\nTenant '${theme.bold(tenantId)}' updated successfully.`));
        console.log(theme.primary('\nUpdated tenant details:'));
        console.log(`${theme.secondary('ID:')}   ${theme.primary(tenant[0].id)}`);
        console.log(`${theme.secondary('Name:')} ${theme.info(tenant[0].name)}`);
      } catch (error) {
        if (error instanceof Error) {
          console.error(theme.error('\nFailed to update tenant:'), error.message);
        } else {
          console.error(theme.error('\nFailed to update tenant:'), error);
        }
        process.exit(1);
      } finally {
        if (sql) {
          await sql.end();
        }
      }
    });

  return tenants;
} 