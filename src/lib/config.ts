import * as fs from 'fs';
import path from 'path';
import os from 'os';
import { GlobalOptions } from './globalOptions';
import { theme } from './colors';

export interface NileConfig {
    apiKey?: string;
    workspace?: string;
    dbHost?: string;
    globalHost?: string;
    authUrl?: string;
    database?: string;
    debug?: boolean;
}

interface Credentials {
    token?: string;
}

export class ConfigManager {
    private globalOptions: GlobalOptions;
    private configPath: string;
    private credentialsPath: string;
    private config: NileConfig = {};
    private credentials: Credentials = {};

    constructor(globalOptions: GlobalOptions) {
        this.globalOptions = globalOptions;
        const configDir = path.join(os.homedir(), '.nile');
        this.configPath = path.join(configDir, 'config.json');
        this.credentialsPath = path.join(configDir, 'credentials.json');
        this.loadConfig();
        if (globalOptions.authUrl) {
            this.config.authUrl = globalOptions.authUrl;
        }
        if (globalOptions.debug !== undefined) {
            this.config.debug = globalOptions.debug;
        }
    }

    private loadConfig(): void {
        try {
            // Ensure .nile directory exists
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            // Load config if it exists
            if (fs.existsSync(this.configPath)) {
                const configContent = fs.readFileSync(this.configPath, 'utf-8');
                this.config = JSON.parse(configContent);
            }

            // Load credentials
            this.loadCredentials();
        } catch (error) {
            console.error('Error loading config:', error);
        }
    }

    private saveConfig(): void {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving config:', error);
            throw new Error('Failed to save config');
        }
    }

    private saveCredentials(): void {
        try {
            const configDir = path.dirname(this.credentialsPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            if (Object.keys(this.credentials).length > 0) {
                fs.writeFileSync(this.credentialsPath, JSON.stringify(this.credentials, null, 2));
                // Reload credentials after saving
                this.loadCredentials();
            } else {
                // If no credentials, remove the credentials file
                if (fs.existsSync(this.credentialsPath)) {
                    fs.unlinkSync(this.credentialsPath);
                }
            }
        } catch (error) {
            console.error('Error saving credentials:', error);
            throw new Error('Failed to save credentials');
        }
    }

    private loadCredentials(): void {
        try {
            if (fs.existsSync(this.credentialsPath)) {
                const credentialsContent = fs.readFileSync(this.credentialsPath, 'utf-8');
                this.credentials = JSON.parse(credentialsContent);
            }
        } catch (error) {
            console.error('Error loading credentials:', error);
        }
    }

    resetConfig(): void {
        this.config = {};
        this.credentials = {};
        this.saveConfig();
        this.saveCredentials();
    }

    // Token management methods
    setToken(token: string): void {
        if (this.globalOptions.debug) {
            console.log(theme.dim('Setting token in credentials...'));
        }
        this.credentials.token = token;
        this.saveCredentials();
        // Ensure credentials are reloaded
        this.loadCredentials();
        if (this.globalOptions.debug) {
            console.log(theme.dim('Token set and credentials reloaded'));
        }
    }

    getToken(): string | undefined {
        // First check for API key (highest priority)
        const apiKey = this.getApiKey();
        if (apiKey) {
            if (this.globalOptions.debug) {
                console.log(theme.dim('Using API key for authentication'));
            }
            return apiKey;
        }

        // If no API key, check credentials file
        const token = this.credentials.token;
        if (this.globalOptions.debug) {
            console.log(theme.dim('Using stored token for authentication'));
        }
        return token;
    }

    removeToken(): void {
        if (this.globalOptions.debug) {
            console.log(theme.dim('Removing token from credentials...'));
        }
        delete this.credentials.token;
        this.saveCredentials();
        // Ensure credentials are reloaded
        this.loadCredentials();
        if (this.globalOptions.debug) {
            console.log(theme.dim('Token removed and credentials reloaded'));
        }
    }

    setApiKey(apiKey: string): NileConfig {
        this.config.apiKey = apiKey;
        this.saveConfig();
        return this.config;
    }

    getApiKey(): string | undefined {
        // 1. Command line argument has highest priority
        if (this.globalOptions.apiKey) {
            return this.globalOptions.apiKey;
        }

        // 2. Config file
        const configApiKey = this.config?.apiKey;
        if (configApiKey) {
            return configApiKey;
        }

        // 3. Environment variable
        return process.env.NILE_API_KEY;
    }

    setWorkspace(workspace: string): NileConfig {
        this.config.workspace = workspace;
        this.saveConfig();
        return this.config;
    }

    getWorkspace(): string | undefined {
        // 1. Command line argument has highest priority
        if (this.globalOptions.workspace) {
            return this.globalOptions.workspace;
        }

        // 2. Config file
        const configWorkspace = this.config?.workspace;
        if (configWorkspace) {
            return configWorkspace;
        }

        // 3. Environment variable
        return process.env.NILE_WORKSPACE;
    }

    setDbHost(dbHost: string): NileConfig {
        this.config.dbHost = dbHost;
        this.saveConfig();
        return this.config;
    }

    getDbHost(): string | undefined {
        // 1. Command line argument has highest priority
        if (this.globalOptions.dbHost) {
            return this.globalOptions.dbHost;
        }

        // 2. Config file
        const configDbHost = this.config?.dbHost;
        if (configDbHost) {
            return configDbHost;
        }

        // 3. Environment variable
        return process.env.NILE_DB_HOST || 'db.thenile.dev';
    }

    setGlobalHost(globalHost: string): NileConfig {
        this.config.globalHost = globalHost;
        this.saveConfig();
        return this.config;
    }

    getGlobalHost(): string | undefined {
        // 1. Command line argument has highest priority
        if (this.globalOptions.globalHost) {
            return this.globalOptions.globalHost;
        }

        // 2. Config file
        const configGlobalHost = this.config?.globalHost;
        if (configGlobalHost) {
            return configGlobalHost;
        }

        // 3. Environment variable
        return process.env.NILE_GLOBAL_HOST || 'global.thenile.dev';
    }

    setDatabase(database: string): NileConfig {
        this.config.database = database;
        this.saveConfig();
        return this.config;
    }

    getDatabase(): string | undefined {
        // 1. Command line argument has highest priority
        if (this.globalOptions.db) {
            return this.globalOptions.db;
        }

        // 2. Config file
        const configDb = this.config?.database;
        if (configDb) {
            return configDb;
        }

        // 3. Environment variable
        return process.env.NILE_DB;
    }

    setAuthUrl(authUrl: string): NileConfig {
        this.config.authUrl = authUrl;
        this.saveConfig();
        return this.config;
    }

    getAuthUrl(): string | undefined {
        // 1. Command line argument has highest priority
        if (this.globalOptions.authUrl) {
            return this.globalOptions.authUrl;
        }

        // 2. Config file
        const configAuthUrl = this.config?.authUrl;
        if (configAuthUrl) {
            return configAuthUrl;
        }

        // 3. Environment variable
        return process.env.NILE_AUTH_URL || 'console.thenile.dev';
    }

    getAllConfig(): NileConfig {
        return { ...this.config };
    }

    getDebug(): boolean {
        return this.config.debug || false;
    }
} 