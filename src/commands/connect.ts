import { Command } from 'commander';
import { Auth } from '../lib/auth';
import { theme, formatCommand } from '../lib/colors';
import { GlobalOptions, getGlobalOptionsHelp } from '../lib/globalOptions';
import { ConfigManager } from '../lib/config';

type GetOptions = () => GlobalOptions;

export function createConnectCommand(getOptions: GetOptions): Command {
  const connect = new Command('connect')
    .description('Connect to Nile')
    .addHelpText('after', `
Examples:
  ${formatCommand('nile connect')}                    Connect to Nile using browser
  ${formatCommand('nile connect status')}             Check connection status
  ${formatCommand('nile connect logout')}             Clear stored credentials

${getGlobalOptionsHelp()}`);

  connect
    .command('login')
    .description('Connect to Nile using browser-based authentication')
    .option('--client-id <id>', 'OAuth client ID', 'nilecli')
    .action(async (cmdOptions) => {
      try {
        const globalOptions = getOptions();
        const configManager = new ConfigManager();
        configManager.initializeWithOptions(globalOptions);

        // First try to get token from existing methods
        const existingToken = await configManager.getToken();
        if (existingToken) {
          console.log(theme.success('Already connected to Nile!'));
          return;
        }

        // If no existing token, start browser-based auth
        console.log(theme.info('Starting browser-based authentication...'));
        if (configManager.getDebug()) {
          console.log('Debug - Auth URL:', configManager.getAuthUrl());
        }
        
        const token = await Auth.getAuthorizationToken(configManager, cmdOptions.clientId);
        if (token) {
          configManager.setToken(token);
          console.log(theme.success('\nSuccessfully connected to Nile!'));
        } else {
          console.error(theme.error('Failed to connect to Nile'));
          process.exit(1);
        }
      } catch (error) {
        console.error(theme.error('Failed to connect:'), error);
        process.exit(1);
      }
    });

  connect
    .command('status')
    .description('Check connection status')
    .action(async () => {
      try {
        const globalOptions = getOptions();
        const configManager = new ConfigManager();
        configManager.initializeWithOptions(globalOptions);
        const token = await configManager.getToken();
        if (token) {
          if (globalOptions.apiKey) {
            console.log(theme.success('Connected to Nile using API key'));
          } else {
            console.log(theme.success('Connected to Nile'));
          }
        } else {
          console.log(theme.warning('Not connected to Nile'));
          console.log(theme.secondary('Run "nile connect" to connect'));
        }
      } catch (error) {
        console.error(theme.error('Failed to check status:'), error);
        process.exit(1);
      }
    });

  connect
    .command('logout')
    .description('Clear stored credentials')
    .action(async () => {
      try {
        const configManager = new ConfigManager();
        configManager.removeToken();
        console.log(theme.success('Successfully logged out'));
      } catch (error) {
        console.error(theme.error('Failed to logout:'), error);
        process.exit(1);
      }
    });

  return connect;
} 