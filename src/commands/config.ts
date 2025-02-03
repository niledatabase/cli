import { Command, Option } from 'commander';
import { ConfigManager } from '../lib/config';
import { getGlobalOptions } from '../lib/globalOptions';

export function configCommand(): Command {
    const command = new Command('config');
    command.description('Manage Nile CLI configuration');

    command
        .addOption(
            new Option('--api-key <key>', 'Set the API key')
                .env('NILE_API_KEY')
        )
        .action((options, cmd) => {
            const globalOpts = getGlobalOptions(cmd.parent!);
            const debug = globalOpts.debug || false;
            
            if (debug) {
                console.log('Debug - Options:', options);
                console.log('Debug - Global options:', globalOpts);
            }
            
            const configManager = new ConfigManager();
            let configChanged = false;
            
            // Handle each config option
            if (globalOpts.apiKey) {
                if (debug) {
                    console.log('Debug - Setting API key:', globalOpts.apiKey);
                }
                configManager.setApiKey(globalOpts.apiKey);
                configChanged = true;
            }

            if (globalOpts.workspace) {
                if (debug) {
                    console.log('Debug - Setting workspace:', globalOpts.workspace);
                }
                configManager.setWorkspace(globalOpts.workspace);
                configChanged = true;
            }

            if (globalOpts.dbHost) {
                if (debug) {
                    console.log('Debug - Setting database host:', globalOpts.dbHost);
                }
                configManager.setDbHost(globalOpts.dbHost);
                configChanged = true;
            }

            if (globalOpts.globalHost) {
                if (debug) {
                    console.log('Debug - Setting global host:', globalOpts.globalHost);
                }
                configManager.setGlobalHost(globalOpts.globalHost);
                configChanged = true;
            }

            if (globalOpts.authUrl) {
                if (debug) {
                    console.log('Debug - Setting auth URL:', globalOpts.authUrl);
                }
                configManager.setAuthUrl(globalOpts.authUrl);
                configChanged = true;
            }

            if (globalOpts.db) {
                if (debug) {
                    console.log('Debug - Setting database:', globalOpts.db);
                }
                configManager.setDatabase(globalOpts.db);
                configChanged = true;
            }

            // Show the current/updated configuration
            const currentConfig = configManager.getAllConfig();
            if (configChanged) {
                console.log('Updated configuration:');
            } else {
                console.log('Current configuration:');
            }
            console.log(JSON.stringify(currentConfig, null, 2));
        });

    command
        .command('reset')
        .description('Reset configuration to defaults')
        .action(() => {
            const configManager = new ConfigManager();
            configManager.resetConfig();
            console.log('Configuration has been reset to defaults.');
        });

    command.addHelpText('after', `
Examples:
  $ nile config                                    Show current configuration
  $ nile config --api-key <key>                   Set API key
  $ nile config --workspace <name>                Set default workspace
  $ nile config --db <name>                       Set default database
  $ nile config --db-host db.example.com          Set database host
  $ nile config --global-host global.example.com  Set global host
  $ nile config --auth-url auth.example.com       Set authentication URL
  $ nile config --api-key <key> --workspace dev   Set multiple configurations
  $ nile config reset                             Reset configuration to defaults
    `);

    return command;
}

// Helper function to get API key with priority order
export function getApiKey(cmdApiKey?: string): string | undefined {
    // 1. Command line argument has highest priority
    if (cmdApiKey) {
        return cmdApiKey;
    }

    // 2. Config file
    const configManager = new ConfigManager();
    const configApiKey = configManager.getApiKey();
    if (configApiKey) {
        return configApiKey;
    }

    // 3. Environment variable
    return process.env.NILE_API_KEY;
}

// Helper function to get workspace with priority order
export function getWorkspace(cmdWorkspace?: string): string | undefined {
    // 1. Command line argument has highest priority
    if (cmdWorkspace) {
        return cmdWorkspace;
    }

    // 2. Config file
    const configManager = new ConfigManager();
    const configWorkspace = configManager.getWorkspace();
    if (configWorkspace) {
        return configWorkspace;
    }

    // 3. Environment variable
    return process.env.NILE_WORKSPACE;
}

// Helper function to get database with priority order
export function getDatabase(cmdDb?: string): string | undefined {
    // 1. Command line argument has highest priority
    if (cmdDb) {
        return cmdDb;
    }

    // 2. Config file
    const configManager = new ConfigManager();
    const configDb = configManager.getDatabase();
    if (configDb) {
        return configDb;
    }

    // 3. Environment variable
    return process.env.NILE_DB;
}

// Helper function to get database host with priority order
export function getDbHost(cmdDbHost?: string): string | undefined {
    // 1. Command line argument has highest priority
    if (cmdDbHost) {
        return cmdDbHost;
    }

    // 2. Config file
    const configManager = new ConfigManager();
    const configDbHost = configManager.getDbHost();
    if (configDbHost) {
        return configDbHost;
    }

    // 3. Environment variable
    return process.env.NILE_DB_HOST || 'db.thenile.dev';
}

// Helper function to get global host with priority order
export function getGlobalHost(cmdGlobalHost?: string): string | undefined {
    // 1. Command line argument has highest priority
    if (cmdGlobalHost) {
        return cmdGlobalHost;
    }

    // 2. Config file
    const configManager = new ConfigManager();
    const configGlobalHost = configManager.getGlobalHost();
    if (configGlobalHost) {
        return configGlobalHost;
    }

    // 3. Environment variable
    return process.env.NILE_GLOBAL_HOST || 'global.thenile.dev';
} 