import * as fs from 'fs';
import path from 'path';
import os from 'os';
import { GlobalOptions } from './globalOptions';

export interface NileConfig {
    apiKey?: string;
    workspace?: string;
    dbHost?: string;
    globalHost?: string;
    authUrl?: string;
    database?: string;
    debug?: boolean;
    token?: string;
}

export class ConfigManager {
    private configPath: string;
    private credentialsPath: string;
    private config: NileConfig = {};

    constructor() {
        const configDir = path.join(os.homedir(), '.nile');
        this.configPath = path.join(configDir, 'config.json');
        this.credentialsPath = path.join(configDir, 'credentials.json');
        this.loadConfig();
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

            // Load credentials if they exist
            if (fs.existsSync(this.credentialsPath)) {
                const credentialsContent = fs.readFileSync(this.credentialsPath, 'utf-8');
                const credentials = JSON.parse(credentialsContent);
                if (credentials.token) {
                    this.config.token = credentials.token;
                }
            }
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
            if (this.config.token) {
                fs.writeFileSync(this.credentialsPath, JSON.stringify({ token: this.config.token }, null, 2));
            } else {
                // If no token, remove the credentials file
                if (fs.existsSync(this.credentialsPath)) {
                    fs.unlinkSync(this.credentialsPath);
                }
            }
        } catch (error) {
            console.error('Error saving credentials:', error);
            throw new Error('Failed to save credentials');
        }
    }

    resetConfig(): void {
        this.config = {};
        this.saveConfig();
        this.saveCredentials();
    }

    // Token management methods
    setToken(token: string): void {
        this.config.token = token;
        this.saveCredentials();
    }

    getToken(): string {
        // First check for API key (highest priority)
        const apiKey = this.getApiKey();
        if (apiKey) {
            return apiKey;
        }

        // If no API key, check credentials file
        if (this.config.token) {
            return this.config.token;
        }

        throw new Error('No authentication token found. Please run "nile connect login" or provide an API key.');
    }

    removeToken(): void {
        delete this.config.token;
        this.saveCredentials();
    }

    setApiKey(apiKey: string): NileConfig {
        this.config.apiKey = apiKey;
        this.saveConfig();
        return this.config;
    }

    getApiKey(options?: GlobalOptions): string | undefined {
        // 1. Command line argument has highest priority
        if (options?.apiKey) {
            return options.apiKey;
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

    getWorkspace(options?: GlobalOptions): string | undefined {
        // 1. Command line argument has highest priority
        if (options?.workspace) {
            return options.workspace;
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

    getDbHost(options?: GlobalOptions): string | undefined {
        // 1. Command line argument has highest priority
        if (options?.dbHost) {
            return options.dbHost;
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

    getGlobalHost(options?: GlobalOptions): string | undefined {
        // 1. Command line argument has highest priority
        if (options?.globalHost) {
            return options.globalHost;
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

    getDatabase(options?: GlobalOptions): string | undefined {
        // 1. Command line argument has highest priority
        if (options?.db) {
            return options.db;
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

    getAuthUrl(options?: GlobalOptions): string | undefined {
        // 1. Command line argument has highest priority
        if (options?.authUrl) {
            return options.authUrl;
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

    // Initialize with command line options which take highest priority
    initializeWithOptions(options: GlobalOptions): void {
        if (options.authUrl) {
            this.config.authUrl = options.authUrl;
        }
        if (options.debug !== undefined) {
            this.config.debug = options.debug;
        }
    }

    getDebug(): boolean {
        return this.config.debug || false;
    }
} 