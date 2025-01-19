import { Command } from 'commander';
import { Config } from '../lib/config';
import { Auth } from '../lib/auth';
import { getAuthToken } from '../lib/authUtils';
import { theme, formatCommand } from '../lib/colors';

interface GlobalOptions {
  apiKey?: string;
  format?: 'human' | 'json' | 'csv';
  color?: boolean;
}

type GetOptions = () => GlobalOptions;

export function createAuthCommand(getOptions: GetOptions): Command {
  const auth = new Command('auth')
    .description('Authenticate with Nile')
    .addHelpText('after', `
Examples:
  ${formatCommand('nile auth login')}                    Login to Nile using browser
  ${formatCommand('nile auth status')}                   Check authentication status
  ${formatCommand('nile auth logout')}                   Clear stored credentials`);

  auth
    .command('login')
    .description('Login to Nile using browser-based authentication')
    .option('--client-id <id>', 'OAuth client ID', 'nile-cli')
    .action(async (options) => {
      try {
        // First try to get token from existing methods
        const globalOptions = getOptions();
        const existingToken = await getAuthToken(globalOptions);
        
        if (existingToken) {
          console.log(theme.success('Already authenticated with Nile!'));
          return;
        }

        // If no existing token, start browser-based auth
        console.log(theme.info('Starting browser-based authentication...'));
        const token = await Auth.getAuthorizationToken(options.clientId);
        
        if (token) {
          console.log(theme.success('\nSuccessfully authenticated with Nile!'));
        } else {
          console.error(theme.error('Failed to authenticate with Nile'));
          process.exit(1);
        }
      } catch (error) {
        console.error(theme.error('Failed to authenticate:'), error);
        process.exit(1);
      }
    });

  auth
    .command('status')
    .description('Check authentication status')
    .action(async () => {
      try {
        const options = getOptions();
        const token = await getAuthToken(options);
        
        if (token) {
          console.log(theme.success('✓ Authenticated with Nile'));
        } else {
          console.log(theme.warning('✗ Not authenticated with Nile'));
          console.log(theme.secondary('Run "nile auth login" to authenticate'));
        }
      } catch (error) {
        console.error(theme.error('Failed to check authentication status:'), error);
        process.exit(1);
      }
    });

  auth
    .command('logout')
    .description('Clear stored credentials')
    .action(async () => {
      try {
        await Config.clearCredentials();
        console.log(theme.success('Successfully logged out'));
      } catch (error) {
        console.error(theme.error('Failed to clear credentials:'), error);
        process.exit(1);
      }
    });

  return auth;
} 