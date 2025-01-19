import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Workspace } from './types';

export class Config {
  private static CONFIG_DIR = join(homedir(), '.nile');
  private static WORKSPACE_FILE = join(Config.CONFIG_DIR, 'workspace.json');
  private static CREDENTIALS_FILE = join(Config.CONFIG_DIR, 'credentials.json');

  static async init(): Promise<void> {
    await fs.mkdir(Config.CONFIG_DIR, { recursive: true });
  }

  static async getWorkspace(): Promise<Workspace | null> {
    try {
      const data = await fs.readFile(Config.WORKSPACE_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  static async setWorkspace(workspace: Workspace): Promise<void> {
    await Config.init();
    await fs.writeFile(Config.WORKSPACE_FILE, JSON.stringify(workspace, null, 2));
  }

  // Alias for backward compatibility
  static async saveWorkspace(workspace: Workspace): Promise<void> {
    return Config.setWorkspace(workspace);
  }

  static async getCredentials(): Promise<{ token: string } | null> {
    try {
      const data = await fs.readFile(Config.CREDENTIALS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  static async setCredentials(credentials: { token: string }): Promise<void> {
    await Config.init();
    await fs.writeFile(Config.CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
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
      await fs.unlink(Config.CREDENTIALS_FILE);
    } catch (error) {
      // Ignore error if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
} 