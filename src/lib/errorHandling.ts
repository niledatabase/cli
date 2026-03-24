import axios from 'axios';
import { theme } from './colors';
import { ConfigManager } from './config';
import { Auth } from './auth';
import { NileAPI } from './api';

export async function forceRelogin(configManager: ConfigManager): Promise<void> {
  configManager.removeToken();
  
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

export type ErrorContext = 'API' | 'Database' | 'Tenant' | 'User';

function getErrorPrefix(context: ErrorContext): string {
  const prefixes: Record<ErrorContext, string> = {
    API: 'Failed to',
    Database: 'Database operation failed:',
    Tenant: 'Tenant operation failed:',
    User: 'User operation failed:'
  };
  return prefixes[context];
}

export async function handleError(
  error: unknown,
  context: ErrorContext,
  operation: string,
  configManager: ConfigManager
): Promise<never> {
  const prefix = getErrorPrefix(context);
  const fullOperation = context === 'API' ? `${prefix} ${operation}` : `${prefix} ${operation}`;
  
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401 || error.message === 'Token is required') {
      await forceRelogin(configManager);
      const token = configManager.getToken();
      if (!token) {
        throw new Error('Failed to get token after re-login');
      }
      throw error;
    }
    
    if (error.response?.data?.errors) {
      console.error(theme.error(fullOperation), new Error(error.response.data.errors.join(', ')));
    } else if (configManager.getDebug()) {
      console.error(theme.error(fullOperation), error);
    } else {
      console.error(theme.error(fullOperation), error.message || 'Unknown error');
    }
  } else if (configManager.getDebug()) {
    console.error(theme.error(fullOperation), error);
  } else {
    console.error(theme.error(fullOperation), error instanceof Error ? error.message : 'Unknown error');
  }
  
  process.exit(1);
}

export const handleApiError = (error: unknown, operation: string, configManager: ConfigManager) =>
  handleError(error, 'API', operation, configManager);

export const handleDatabaseError = (error: unknown, operation: string, configManager: ConfigManager) =>
  handleError(error, 'Database', operation, configManager);

export const handleTenantError = (error: unknown, operation: string, configManager: ConfigManager) =>
  handleError(error, 'Tenant', operation, configManager);

export const handleUserError = (error: unknown, operation: string, configManager: ConfigManager) =>
  handleError(error, 'User', operation, configManager); 