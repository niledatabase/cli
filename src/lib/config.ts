import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Workspace } from './types';

export class Config {
  private static CONFIG_DIR = path.join(os.homedir(), '.config', 'niledb');

  static async init() {
    await fs.mkdir(Config.CONFIG_DIR, { recursive: true });
  }

  static async getToken(): Promise<string | null> {
    try {
      const token = await fs.readFile(
        path.join(Config.CONFIG_DIR, 'token'),
        'utf-8'
      );
      return token.trim();
    } catch {
      return null;
    }
  }

  static async saveToken(token: string): Promise<void> {
    await Config.init();
    await fs.writeFile(path.join(Config.CONFIG_DIR, 'token'), token);
  }

  static async getWorkspace(): Promise<Workspace | null> {
    try {
      const data = await fs.readFile(
        path.join(Config.CONFIG_DIR, 'workspace'),
        'utf-8'
      );
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  static async saveWorkspace(workspace: Workspace): Promise<void> {
    await Config.init();
    await fs.writeFile(
      path.join(Config.CONFIG_DIR, 'workspace'),
      JSON.stringify(workspace)
    );
  }

  static async removeToken(): Promise<void> {
    try {
      await fs.unlink(path.join(Config.CONFIG_DIR, 'token'));
    } catch {
      // Ignore if file doesn't exist
    }
  }
} 