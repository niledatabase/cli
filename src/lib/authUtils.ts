import { Config } from './config';
import { Auth } from './auth';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { GlobalOptions } from './globalOptions';

export async function getAuthToken(options: GlobalOptions = {}): Promise<string> {
  // 1. Check for --api-key option
  if (options.apiKey) {
    return options.apiKey;
  }

  // 2. Check for NILE_API_KEY environment variable
  if (process.env.NILE_API_KEY) {
    return process.env.NILE_API_KEY;
  }

  // 3. Check for credentials.json file
  try {
    const credentialsPath = path.join(os.homedir(), '.config', 'niledb', 'credentials.json');
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    if (credentials.access_token) {
      return credentials.access_token;
    }
  } catch (error) {
    // File doesn't exist or is invalid, continue to web auth
  }

  // 4. Fallback to web authentication
  const token = await Auth.getAuthorizationToken();
  await Config.saveToken(token);
  return token;
} 