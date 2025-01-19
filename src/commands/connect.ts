import { Command } from 'commander';
import { Auth } from '../lib/auth';
import { Config } from '../lib/config';
import { getAuthToken, AuthOptions } from '../lib/authUtils';
import chalk from 'chalk';

type GetOptions = () => AuthOptions;

export function createConnectCommand(getOptions: GetOptions): Command {
  const connect = new Command('connect')
    .description('Manage authentication and connection to Nile');

  connect
    .command('login')
    .description('Login to Nile')
    .option('--client-id <clientId>', 'Optional: Specify a custom client ID')
    .action(async (options) => {
      try {
        const globalOptions = getOptions();
        // If API key is provided, save it and skip web auth
        if (globalOptions.apiKey) {
          await Config.saveToken(globalOptions.apiKey);
          console.log(chalk.green('Successfully authenticated with API key'));
          return;
        }

        console.log(chalk.blue('Opening browser for authentication...'));
        const token = await getAuthToken(globalOptions);
        await Config.saveToken(token);
        console.log(chalk.green('Authentication successful! You are now logged in.'));
      } catch (error) {
        console.error(chalk.red('Authentication failed:'), error);
        process.exit(1);
      }
    });

  connect
    .command('logout')
    .description('Logout from Nile')
    .action(async () => {
      try {
        await Config.removeToken();
        console.log(chalk.green('You have been logged out.'));
      } catch (error) {
        console.error(chalk.red('Logout failed:'), error);
        process.exit(1);
      }
    });

  return connect;
} 