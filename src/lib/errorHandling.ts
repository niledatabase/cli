import axios from 'axios';
import { theme } from './colors';
import { GlobalOptions } from './globalOptions';
import { ConfigManager } from './config';
import { Auth } from './auth';
import { NileAPI } from './api';

/**
 * Forces a re-login when authentication fails
 */
export async function forceRelogin(configManager: ConfigManager): Promise<void> {
  configManager.removeToken(); // Clear the invalid token
  
  console.log(theme.warning('\nAuthentication failed. Forcing re-login...'));
  const token = await Auth.getAuthorizationToken(configManager);
  if (token) {
    if (configManager.getDebug()) {
      console.log('Debug - Token received from auth flow');
    }
    configManager.setToken(token);
    if (configManager.getDebug()) {
      console.log('Debug - Token saved to config manager');
      const savedToken = configManager.getToken();
      console.log('Debug - Token retrieved from config manager:', savedToken ? 'present' : 'missing');
    }
    console.log(theme.success('Successfully re-authenticated!'));
    
    // Verify workspace access after re-authentication
    const workspaceSlug = configManager.getWorkspace();
    if (workspaceSlug) {
      try {
        const api = new NileAPI({
          token,
          controlPlaneUrl: configManager.getGlobalHost(),
          debug: configManager.getDebug()
        });
        await api.getWorkspace(workspaceSlug);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          console.error(theme.error(`\nWorkspace '${workspaceSlug}' is not accessible with the new token.`));
          console.error(theme.warning('Please use a different workspace or contact your administrator.'));
          process.exit(1);
        }
        throw error;
      }
    }
  } else {
    console.error(theme.error('Failed to re-authenticate'));
    process.exit(1);
  }
}

/**
 * Handles API errors consistently across all commands
 * @param error The error object
 * @param operation Description of the operation that failed
 * @param configManager The ConfigManager instance to use
 */
export async function handleApiError(error: any, operation: string, configManager: ConfigManager): Promise<never> {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401 || error.message === 'Token is required') {
      await forceRelogin(configManager);
      // Retry the operation after re-login
      const token = configManager.getToken();
      if (!token) {
        throw new Error('Failed to get token after re-login');
      }
      throw error;
    } else if (error.response?.data?.errors) {
      console.error(theme.error(`Failed to ${operation}:`), new Error(error.response.data.errors.join(', ')));
    } else if (configManager.getDebug()) {
      console.error(theme.error(`Failed to ${operation}:`), error);
    } else {
      console.error(theme.error(`Failed to ${operation}:`), error.message || 'Unknown error');
    }
  } else if (configManager.getDebug()) {
    console.error(theme.error(`Failed to ${operation}:`), error);
  } else {
    console.error(theme.error(`Failed to ${operation}:`), error instanceof Error ? error.message : 'Unknown error');
  }
  process.exit(1);
}

/**
 * Handles database-specific errors
 * @param error The error object
 * @param operation Description of the operation that failed
 * @param configManager The ConfigManager instance to use
 */
export async function handleDatabaseError(error: any, operation: string, configManager: ConfigManager): Promise<never> {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401 || error.message === 'Token is required') {
      await forceRelogin(configManager);
      // Retry the operation after re-login
      throw error;
    } else if (error.response?.data?.errors) {
      console.error(theme.error(`Database operation failed: ${operation}`), new Error(error.response.data.errors.join(', ')));
    } else if (configManager.getDebug()) {
      console.error(theme.error(`Database operation failed: ${operation}`), error);
    } else {
      console.error(theme.error(`Database operation failed: ${operation}`), error.message || 'Unknown error');
    }
  } else if (configManager.getDebug()) {
    console.error(theme.error(`Database operation failed: ${operation}`), error);
  } else {
    console.error(theme.error(`Database operation failed: ${operation}`), error instanceof Error ? error.message : 'Unknown error');
  }
  process.exit(1);
}

/**
 * Handles tenant-specific errors
 * @param error The error object
 * @param operation Description of the operation that failed
 * @param configManager The ConfigManager instance to use
 */
export async function handleTenantError(error: any, operation: string, configManager: ConfigManager): Promise<never> {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401 || error.message === 'Token is required') {
      await forceRelogin(configManager);
      // Retry the operation after re-login
      throw error;
    } else if (error.response?.data?.errors) {
      console.error(theme.error(`Tenant operation failed: ${operation}`), new Error(error.response.data.errors.join(', ')));
    } else if (configManager.getDebug()) {
      console.error(theme.error(`Tenant operation failed: ${operation}`), error);
    } else {
      console.error(theme.error(`Tenant operation failed: ${operation}`), error.message || 'Unknown error');
    }
  } else if (configManager.getDebug()) {
    console.error(theme.error(`Tenant operation failed: ${operation}`), error);
  } else {
    console.error(theme.error(`Tenant operation failed: ${operation}`), error instanceof Error ? error.message : 'Unknown error');
  }
  process.exit(1);
}

/**
 * Handles user-specific errors
 * @param error The error object
 * @param operation Description of the operation that failed
 * @param configManager The ConfigManager instance to use
 */
export async function handleUserError(error: any, operation: string, configManager: ConfigManager): Promise<never> {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401 || error.message === 'Token is required') {
      await forceRelogin(configManager);
      // Retry the operation after re-login
      throw error;
    } else if (error.response?.data?.errors) {
      console.error(theme.error(`User operation failed: ${operation}`), new Error(error.response.data.errors.join(', ')));
    } else if (configManager.getDebug()) {
      console.error(theme.error(`User operation failed: ${operation}`), error);
    } else {
      console.error(theme.error(`User operation failed: ${operation}`), error.message || 'Unknown error');
    }
  } else if (configManager.getDebug()) {
    console.error(theme.error(`User operation failed: ${operation}`), error);
  } else {
    console.error(theme.error(`User operation failed: ${operation}`), error instanceof Error ? error.message : 'Unknown error');
  }
  process.exit(1);
} 