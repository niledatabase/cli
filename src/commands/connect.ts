import { Command } from 'commander';
import { Auth } from '../lib/auth';
import { Config } from '../lib/config';
import chalk from 'chalk';

export function createConnectCommand(): Command {
  const connect = new Command('connect')
    .description('Manage authentication and connection to Nile');

  connect
    .command('login')
    .description('Login to Nile')
    .action(async () => {
      try {
        const clientId = process.env.NILE_CLIENT_ID;
        const clientSecret = process.env.NILE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          throw new Error('NILE_CLIENT_ID and NILE_CLIENT_SECRET must be set');
        }

        console.log(chalk.blue('Opening browser for authentication...'));
        const token = await Auth.getAuthorizationToken(clientId, clientSecret);
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