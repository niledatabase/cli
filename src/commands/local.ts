import { Command } from 'commander';
import { theme, formatCommand } from '../lib/colors';
import { GlobalOptions, getGlobalOptionsHelp } from '../lib/globalOptions';
import { spawn, exec } from 'child_process';
import readline from 'readline';
import ora from 'ora';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

type GetOptions = () => GlobalOptions;

async function waitForPostgres(getOptions: GetOptions, retries = 30, interval = 1000): Promise<boolean> {
  const command = 'docker exec nile-local pg_isready -U 00000000-0000-0000-0000-000000000000 -p 5432 -d test -h localhost';
  
  for (let i = 0; i < retries; i++) {
    try {
      const { stdout } = await execAsync(command);
      if (stdout.includes('accepting connections')) {
        return true;
      }
    } catch (error: any) {
      const options = getOptions();
      if (options.debug) {
        console.log(theme.dim(`Waiting for PostgreSQL (attempt ${i + 1}/${retries})...`));
        if (error.stdout) console.log(theme.dim('stdout:'), error.stdout);
        if (error.stderr) console.log(theme.dim('stderr:'), error.stderr);
      }
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, interval));
      continue;
    }
  }
  return false;
}

async function isDockerRunning(): Promise<boolean> {
  try {
    await execAsync('docker info');
    return true;
  } catch (error: any) {
    return false;
  }
}

function getDockerStartCommand(): string {
  const platform = os.platform();
  switch (platform) {
    case 'darwin':
      return 'open -a Docker';
    case 'win32':
      return 'start /B "" "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"';
    default:
      return 'systemctl start docker';
  }
}

function getDockerInstallInstructions(): string {
  const platform = os.platform();
  switch (platform) {
    case 'darwin':
      return 'https://docs.docker.com/desktop/install/mac-install/';
    case 'win32':
      return 'https://docs.docker.com/desktop/install/windows-install/';
    default:
      return 'https://docs.docker.com/engine/install/';
  }
}

export function createLocalCommand(getOptions: GetOptions): Command {
  const local = new Command('local')
    .description('Manage local development environment')
    .addHelpText('after', `
Examples:
  ${formatCommand('nile local start')}                Start local development environment
  ${formatCommand('nile local start', '--no-prompt')} Start without prompting for psql connection
  ${formatCommand('nile local stop')}                 Stop local development environment
  ${formatCommand('nile local info')}                 Show connection information

${getGlobalOptionsHelp()}`);

  local
    .command('info')
    .description('Show connection information for local environment')
    .action(async () => {
      try {
        // Check if container is running
        const { stdout } = await execAsync('docker ps --filter name=nile-local --format {{.Names}}');
        if (!stdout.includes('nile-local')) {
          console.error(theme.error('\nNo Nile local environment is currently running.'));
          console.log(theme.dim('Start it with: nile local start'));
          process.exit(1);
        }

        // Display connection information
        console.log('\nConnection Information:');
        console.log(theme.info('Host:     ') + 'localhost');
        console.log(theme.info('Port:     ') + '5432');
        console.log(theme.info('Database: ') + 'test');
        console.log(theme.info('Username: ') + '00000000-0000-0000-0000-000000000000');
        console.log(theme.info('Password: ') + 'password');

        // Show direct connection command in debug mode
        const options = getOptions();
        if (options.debug) {
          console.log(theme.dim('\nDirect connection command:'));
          console.log(theme.dim('PGPASSWORD=password psql -h localhost -p 5432 -U 00000000-0000-0000-0000-000000000000 -d test'));
        }
      } catch (error: any) {
        const options = getOptions();
        if (options.debug) {
          console.error(theme.error('\nFailed to check environment status:'), error);
        } else {
          console.error(theme.error('\nFailed to check environment status:'), error.message || 'Unknown error');
        }
        process.exit(1);
      }
    });

  local
    .command('stop')
    .description('Stop local development environment')
    .action(async () => {
      try {
        // Check if container is running
        const { stdout } = await execAsync('docker ps --filter name=nile-local --format {{.Names}}');
        if (!stdout.includes('nile-local')) {
          console.error(theme.error('\nNo Nile local environment is currently running.'));
          process.exit(1);
        }

        // Start spinner for stopping container
        const stopSpinner = ora({
          text: 'Stopping local development environment...',
          color: 'cyan'
        }).start();

        try {
          await execAsync('docker stop nile-local && docker rm nile-local');
          stopSpinner.succeed('Local environment stopped successfully');
        } catch (error: any) {
          stopSpinner.fail('Failed to stop local environment');
          if (getOptions().debug) {
            console.error(theme.error('Error details:'), error.message);
          }
          process.exit(1);
        }
      } catch (error: any) {
        const options = getOptions();
        if (options.debug) {
          console.error(theme.error('Failed to check container status:'), error);
        } else {
          console.error(theme.error('Failed to check container status:'), error.message || 'Unknown error');
        }
        process.exit(1);
      }
    });

  local
    .command('start')
    .description('Start local development environment')
    .option('--no-prompt', 'Start without prompting for psql connection')
    .action(async (cmdOptions) => {
      try {
        // Check if Docker daemon is running
        const dockerRunning = await isDockerRunning();
        if (!dockerRunning) {
          console.error(theme.error('\nDocker daemon is not running.'));
          console.log(theme.info('\nTo start Docker:'));
          console.log(theme.dim(`Run: ${getDockerStartCommand()}`));
          console.log(theme.info('\nIf Docker is not installed:'));
          console.log(theme.dim(`Visit: ${getDockerInstallInstructions()}`));
          process.exit(1);
        }

        // Check if container is already running
        try {
          const { stdout } = await execAsync('docker ps --filter name=nile-local --format {{.Names}}');
          if (stdout.includes('nile-local')) {
            console.error(theme.error('\nA Nile local environment is already running.'));
            console.log(theme.dim('To stop it, use: docker stop nile-local'));
            process.exit(1);
          }
        } catch (error) {
          // Ignore error, means docker ps failed which is fine
        }

        // Start spinner for Docker pull
        const pullSpinner = ora({
          text: 'Pulling latest Nile testing container...',
          color: 'cyan'
        }).start();

        try {
          await execAsync('docker pull ghcr.io/niledatabase/testingcontainer:latest');
          pullSpinner.succeed('Latest Nile testing container pulled successfully');
        } catch (error: any) {
          pullSpinner.fail('Failed to pull latest container');
          if (getOptions().debug) {
            console.error(theme.error('Error details:'), error.message);
          }
          process.exit(1);
        }
        
        // Start spinner for container launch
        const startSpinner = ora({
          text: 'Starting local development environment...',
          color: 'cyan'
        }).start();
        
        // Start Docker container in background
        const docker = spawn('docker', [
          'run',
          '--name', 'nile-local',
          '-d',  // Run in background
          '-p', '5432:5432',
          'ghcr.io/niledatabase/testingcontainer:latest'
        ]);

        // Collect any error output
        let errorOutput = '';
        docker.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        // Wait for container to start
        await new Promise((resolve, reject) => {
          docker.on('close', (code) => {
            if (code !== 0) {
              reject(new Error(`Docker failed to start: ${errorOutput}`));
            } else {
              resolve(undefined);
            }
          });
        });

        // Wait for PostgreSQL to be ready
        const readySpinner = ora({
          text: 'Waiting for database to be ready...',
          color: 'cyan'
        }).start();

        const isReady = await waitForPostgres(getOptions);
        if (!isReady) {
          readySpinner.fail('Database failed to start within timeout period');
          console.log(theme.dim('\nStopping container...'));
          try {
            await execAsync('docker stop nile-local && docker rm nile-local');
          } catch (error) {
            // Ignore cleanup errors
          }
          process.exit(1);
        }

        readySpinner.succeed('Database is ready');
        startSpinner.succeed('Local development environment started successfully');

        // Display connection information
        console.log('\nConnection Information:');
        console.log(theme.info('Host:     ') + 'localhost');
        console.log(theme.info('Port:     ') + '5432');
        console.log(theme.info('Database: ') + 'test');
        console.log(theme.info('Username: ') + '00000000-0000-0000-0000-000000000000');
        console.log(theme.info('Password: ') + 'password');

        if (cmdOptions.prompt) {
          // Create readline interface
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });

          // Ask if user wants to connect with psql
          rl.question('\nWould you like to connect using psql? (y/N) ', async (answer) => {
            rl.close();
            if (answer.toLowerCase() === 'y') {
              const connectSpinner = ora({
                text: 'Connecting...',
                color: 'cyan'
              }).start();

              // Add a longer delay to ensure the database is fully ready for connections
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              // Connect using psql with individual parameters
              const psql = spawn('psql', [
                '-h', 'localhost',
                '-p', '5432',
                '-U', '00000000-0000-0000-0000-000000000000',
                '-d', 'test',
                '-w'  // Never prompt for password
              ], {
                stdio: 'inherit',
                env: {
                  ...process.env,
                  PGPASSWORD: 'password'  // Set password via environment variable
                }
              });

              // Stop the spinner immediately as psql will take over the terminal
              connectSpinner.stop();

              // Handle psql exit
              psql.on('exit', (code) => {
                if (code !== 0) {
                  console.error(theme.error('\nFailed to connect using psql. Please check if psql is installed.'));
                  if (getOptions().debug) {
                    console.error(theme.dim('Try connecting directly with:'));
                    console.error(theme.dim('PGPASSWORD=password psql -h localhost -p 5432 -U 00000000-0000-0000-0000-000000000000 -d test'));
                  }
                }
                // Note: Don't exit here as the Docker container should keep running
              });

              // Handle psql error
              psql.on('error', (error) => {
                connectSpinner.fail('Failed to launch psql');
                console.error(theme.error('\nError launching psql:'), error.message);
                if (error.message.includes('ENOENT')) {
                  console.error(theme.error('Please make sure psql is installed and available in your PATH'));
                }
              });
            } else {
              console.log(theme.dim('\nYou can connect to the database using your preferred client with the connection information above.'));
              console.log(theme.dim('To stop the environment, use: nile local stop'));
            }
          });
        } else {
          console.log(theme.dim('\nTo stop the environment, use: nile local stop'));
        }

        // Handle process termination
        process.on('SIGINT', async () => {
          console.log(theme.dim('\nStopping local development environment...'));
          try {
            await execAsync('docker stop nile-local && docker rm nile-local');
            console.log(theme.success('Local environment stopped successfully'));
          } catch (error) {
            console.error(theme.error('Failed to stop local environment cleanly'));
          }
          process.exit(0);
        });

      } catch (error: any) {
        const options = getOptions();
        if (options.debug) {
          console.error(theme.error('Failed to start local environment:'), error);
        } else {
          console.error(theme.error('Failed to start local environment:'), error.message || 'Unknown error');
        }
        // Cleanup on error
        try {
          await execAsync('docker stop nile-local && docker rm nile-local');
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        process.exit(1);
      }
    });

  return local;
} 