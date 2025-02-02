import { Config } from './config';
import { Auth } from './auth';
import { ConfigManager } from './config';
import { GlobalOptions } from './globalOptions';

export async function getAuthToken(options: GlobalOptions = {}): Promise<string> {
    // 1. Check for stored token in credentials.json (highest priority for stored auth)
    try {
        const credentials = await Config.getCredentials();
        if (credentials?.token) {
            return credentials.token;
        }
    } catch (error) {
        // Ignore error if credentials file doesn't exist or is invalid
    }

    // 2. Check for API key from ConfigManager (handles CLI args, config file, env vars)
    const configManager = new ConfigManager();
    const apiKey = configManager.getApiKey(options);
    if (apiKey) {
        return apiKey;
    }

    // 3. Fallback to web authentication
    const token = await Auth.getAuthorizationToken();
    await Config.saveToken(token);
    return token;
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