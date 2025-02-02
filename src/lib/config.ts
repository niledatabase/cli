import * as fs from 'fs';
import path from 'path';
import os from 'os';
import { Workspace } from './types';
import { GlobalOptions } from './globalOptions';

export interface Database {
  name: string;
}

export class Config {
  private static CONFIG_DIR = path.join(os.homedir(), '.nile');
  private static WORKSPACE_FILE = path.join(Config.CONFIG_DIR, 'workspace.json');
  private static CREDENTIALS_FILE = path.join(Config.CONFIG_DIR, 'credentials.json');
  private static CONFIG_FILE = path.join(Config.CONFIG_DIR, 'config.json');

  static async init(): Promise<void> {
    await fs.promises.mkdir(Config.CONFIG_DIR, { recursive: true });
  }

  private static async read(): Promise<any> {
    try {
      await Config.init();
      const data = await fs.promises.readFile(Config.CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist, return empty object
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  private static async write(config: any): Promise<void> {
    await Config.init();
    await fs.promises.writeFile(Config.CONFIG_FILE, JSON.stringify(config, null, 2));
  }

  static async getWorkspace(): Promise<Workspace | null> {
    try {
      const data = await fs.promises.readFile(Config.WORKSPACE_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  static async setWorkspace(workspace: Workspace): Promise<void> {
    await Config.init();
    await fs.promises.writeFile(Config.WORKSPACE_FILE, JSON.stringify(workspace, null, 2));
  }

  // Alias for backward compatibility
  static async saveWorkspace(workspace: Workspace): Promise<void> {
    return Config.setWorkspace(workspace);
  }

  static async getCredentials(): Promise<{ token: string } | null> {
    try {
      const data = await fs.promises.readFile(Config.CREDENTIALS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  static async setCredentials(credentials: { token: string }): Promise<void> {
    await Config.init();
    await fs.promises.writeFile(Config.CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
  }

  // Token-related methods for backward compatibility
  static async saveToken(token: string): Promise<void> {
    return Config.setCredentials({ token });
  }

  static async removeToken(): Promise<void> {
    return Config.clearCredentials();
  }

  static async clearCredentials(): Promise<void> {
    try {
      await fs.promises.unlink(Config.CREDENTIALS_FILE);
    } catch (error) {
      // Ignore error if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  static async setDatabase(database: Database): Promise<void> {
    const config = await this.read();
    config.database = database;
    await this.write(config);
  }

  static async getDatabase(): Promise<Database | undefined> {
    const config = await this.read();
    return config.database;
  }
}

interface NileConfig {
    apiKey?: string;
    workspace?: string;
    dbHost?: string;
    globalHost?: string;
    database?: string;
}

export class ConfigManager {
    private configPath: string;
    private config: NileConfig;

    constructor() {
        this.configPath = path.join(os.homedir(), '.nile', 'config.json');
        this.config = this.loadConfig();
    }

    private loadConfig(): NileConfig {
        try {
            // Ensure .nile directory exists
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            // Load config if it exists, otherwise return empty config
            if (fs.existsSync(this.configPath)) {
                const configContent = fs.readFileSync(this.configPath, 'utf-8');
                return JSON.parse(configContent);
            }
            return {};
        } catch (error) {
            console.error('Error loading config:', error);
            return {};
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

    getAllConfig(): NileConfig {
        return { ...this.config };
    }
} 