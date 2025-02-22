import { Command } from 'commander';
import { theme, formatCommand } from '../lib/colors';
import { GlobalOptions, getGlobalOptionsHelp } from '../lib/globalOptions';
import { NileAPI } from '../lib/api';
import { ConfigManager } from '../lib/config';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Updated color theme with orange gradients
const styles = {
  primary: (text: string) => theme.primary(text),
  secondary: (text: string) => theme.accent(text),
  highlight: (text: string) => theme.bold(theme.primary(text)),
  code: (text: string) => theme.info(text),
  success: (text: string) => theme.success(text),
  info: (text: string) => theme.info(text),
  command: (text: string) => theme.accent(text),
  output: (text: string) => theme.secondary(text)
};

type GetOptions = () => GlobalOptions;

async function streamLog(message: string, delayMs = 30) {
  const chars = message.split('');
  for (const char of chars) {
    process.stdout.write(char);
    await sleep(delayMs);
  }
  process.stdout.write('\n');
}

export function createAuthCommand(getOptions: GetOptions): Command {
  const auth = new Command('auth')
    .description('Authentication and authorization utilities')
    .addHelpText('after', `
Examples:
  ${formatCommand('nile auth quickstart --nextjs')}     Create a Next.js app with Nile auth
  
${getGlobalOptionsHelp()}`);

  auth
    .command('quickstart')
    .description('Set up a new application with Nile authentication')
    .option('--nextjs', 'Create a Next.js application')
    .action(async (cmdOptions) => {
      if (!cmdOptions.nextjs) {
        console.error(theme.error('Please specify the framework (currently only --nextjs is supported)'));
        process.exit(1);
      }

      // Display intro message
      await streamLog(styles.highlight('\n✨ Add Multi-tenant Authentication in 2 minutes'));
      await sleep(500);

      try {
        // Step 1: Create Next.js app
        await streamLog(styles.secondary('\nStep 1: Creating Next.js Application'));
        await sleep(300);
        await streamLog(styles.command('Running command: ') + styles.info('npx create-next-app@latest nile-app --yes'));
        await sleep(500);
        
        const step1 = ora({
          text: 'Creating application...',
          color: 'yellow'
        }).start();

        try {
          const { stdout: createAppOutput } = await execAsync('npx create-next-app@latest nile-app --yes');
          step1.succeed('Next.js application created successfully');
          await sleep(300);
          
          await streamLog(styles.command('\nChanging directory: ') + styles.info('cd nile-app'));
          process.chdir('nile-app');
          await sleep(300);
          await streamLog(styles.success('✓ Successfully created Next.js application'));
          await sleep(500);
        } catch (error: any) {
          step1.fail('Failed to create Next.js application');
          if (getOptions().debug) {
            console.error(theme.error('Error details:'), error.message);
          }
          process.exit(1);
        }

        // Step 2: Get database credentials and create .env
        await streamLog(styles.secondary('\nStep 2: Setting Up Database Credentials'));
        await sleep(300);
        
        const step2 = ora({
          text: 'Fetching credentials from Nile...',
          color: 'yellow'
        }).start();

        try {
          const options = getOptions();
          const configManager = new ConfigManager(options);
          const api = new NileAPI({
            token: configManager.getToken(),
            dbHost: configManager.getDbHost(),
            controlPlaneUrl: configManager.getGlobalHost(),
          });

          const { workspaceSlug, databaseName } = await getWorkspaceAndDatabase(options);
          const credentials = await api.createDatabaseCredentials(workspaceSlug, databaseName);
          const database = await api.getDatabase(workspaceSlug, databaseName);
          
          step2.succeed('Received credentials from Nile database');
          await sleep(300);

          await streamLog(styles.code('Constructing environmental variables...'));
          await sleep(300);

          const envContent = `NILEDB_USER=${credentials.id}
NILEDB_PASSWORD=${credentials.password}
NILEDB_API_URL=https://us-west-2.api.thenile.dev/v2/databases/${database.id}
NILEDB_POSTGRES_URL=postgres://us-west-2.db.thenile.dev:5432/${databaseName}`;

          await streamLog(styles.code('Applying environmental variables to .env.local...'));
          await sleep(300);
          await streamLog(styles.info('\n```env'));
          const envLines = envContent.split('\n');
          for (const line of envLines) {
            await streamLog(line, 50);
          }
          await streamLog(styles.info('```'));

          await fs.writeFile('.env.local', envContent);
          await sleep(300);
          await streamLog(styles.success('✓ Successfully configured environment variables'));
          await sleep(500);
        } catch (error: any) {
          step2.fail('Failed to set up database credentials');
          if (getOptions().debug) {
            console.error(theme.error('Error details:'), error.message);
          }
          process.exit(1);
        }

        // Step 3: Install Nile packages
        await streamLog(styles.secondary('\nStep 3: Installing Nile Packages'));
        await sleep(300);
        await streamLog(styles.command('Running command: ') + styles.info('npm install @niledatabase/server @niledatabase/react'));
        await sleep(500);
        
        const step3 = ora({
          text: 'Installing packages...',
          color: 'yellow'
        }).start();

        try {
          const { stdout: installOutput } = await execAsync('npm install @niledatabase/server @niledatabase/react');
          step3.succeed('Nile packages installed successfully');
          await sleep(300);
          
          await streamLog(styles.code('\nPackages installed:'));
          const installLines = installOutput.split('\n');
          for (const line of installLines) {
            if (line.trim()) {
              await streamLog(styles.code(line), 10);
            }
          }
          await streamLog(styles.success('✓ Successfully installed Nile packages'));
          await sleep(500);
        } catch (error: any) {
          step3.fail('Failed to install Nile packages');
          if (getOptions().debug) {
            console.error(theme.error('Error details:'), error.message);
          }
          process.exit(1);
        }

        // Step 4: Create API directory
        await streamLog(styles.secondary('\nStep 4: Setting Up API Routes'));
        await sleep(300);

        try {
          await streamLog(styles.command('Creating API directory structure...'));
          await fs.mkdir('app/api/[...nile]', { recursive: true });
          await sleep(300);
          await streamLog(styles.success('✓ Created directory: ') + styles.info('app/api/[...nile]'));
          await sleep(300);
          
          // Create nile.ts
          await streamLog(styles.command('\nCreating Nile configuration file...'));
          const nileTsContent = `import { Nile } from "@niledatabase/server";
export const nile = await Nile();
export const { handlers } = nile.api;`;

          await streamLog(styles.info('app/api/[...nile]/nile.ts'));
          await sleep(300);
          await streamLog(styles.command('\nConfiguration file (3 lines):'));
          await streamLog(styles.info('\n```typescript'));
          const nileTsLines = nileTsContent.split('\n');
          for (const line of nileTsLines) {
            await streamLog(line, 50);
          }
          await streamLog(styles.info('```'));
          await fs.writeFile('app/api/[...nile]/nile.ts', nileTsContent);
          await sleep(300);
          await streamLog(styles.success('✓ Created Nile configuration'));
          await sleep(300);

          // Create route.ts
          await streamLog(styles.command('\nCreating API route handlers...'));
          const routeTsContent = `import { handlers } from "./nile";
export const { POST, GET, DELETE, PUT } = handlers;`;

          await streamLog(styles.info('app/api/[...nile]/route.ts'));
          await sleep(300);
          await streamLog(styles.command('\nRoute handlers file (2 lines):'));
          await streamLog(styles.info('\n```typescript'));
          const routeTsLines = routeTsContent.split('\n');
          for (const line of routeTsLines) {
            await streamLog(line, 50);
          }
          await streamLog(styles.info('```'));
          await fs.writeFile('app/api/[...nile]/route.ts', routeTsContent);
          await sleep(300);
          await streamLog(styles.success('✓ Created API route handlers'));
          await sleep(300);

          await streamLog(styles.success('\n✓ Successfully configured API routes'));
          await sleep(500);
        } catch (error: any) {
          console.error(theme.error('\nFailed to set up API routes'));
          if (getOptions().debug) {
            console.error(theme.error('Error details:'), error.message);
          }
          process.exit(1);
        }

        // Step 5: Update page.tsx
        await streamLog(styles.secondary('\nStep 5: Configuring Authentication Components'));
        await sleep(300);

        try {
          await streamLog(styles.command('Deleting content in app/page.tsx and applying Nile component code...'));
          await sleep(300);

          const pageTsxContent = `import {
  SignOutButton,
  SignUpForm,
  SignedIn,
  SignedOut,
  UserInfo,
} from "@niledatabase/react";
import "@niledatabase/react/styles.css";

export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <SignedIn>
        <UserInfo />
        <SignOutButton />
      </SignedIn>
      <SignedOut>
        <SignUpForm />
      </SignedOut>
    </div>
  );
}`;

          const lineCount = pageTsxContent.split('\n').length;
          await streamLog(styles.command(`\nAuthentication component file (${lineCount} lines):`));
          await streamLog(styles.info('\n```typescript'));
          const pageTsxLines = pageTsxContent.split('\n');
          for (const line of pageTsxLines) {
            await streamLog(line, 10);
          }
          await streamLog(styles.info('```'));

          await fs.writeFile('app/page.tsx', pageTsxContent);
          await sleep(300);
          await streamLog(styles.success('✓ Successfully configured authentication components'));
          await sleep(500);
        } catch (error: any) {
          console.error(theme.error('\nFailed to configure authentication components'));
          if (getOptions().debug) {
            console.error(theme.error('Error details:'), error.message);
          }
          process.exit(1);
        }

        // Step 6: Start development server
        await streamLog(styles.secondary('\nStep 6: Starting Development Server'));
        await sleep(300);
        await streamLog(styles.command('Running command: ') + styles.info('npm run dev'));
        await sleep(500);
        
        const step6 = ora({
          text: 'Starting server...',
          color: 'yellow'
        }).start();

        try {
          const devServer = spawn('npm', ['run', 'dev'], {
            stdio: 'inherit'
          });

          devServer.on('error', (error) => {
            step6.fail('Failed to start development server');
            if (getOptions().debug) {
              console.error(theme.error('Error details:'), error.message);
            }
            process.exit(1);
          });

          step6.succeed('Development server started successfully');
          await sleep(500);
          await streamLog(styles.success('\n✨ Setup Complete! Your Next.js application with Nile authentication is ready!'));
          await sleep(300);
          await streamLog(styles.info('\nOpen http://localhost:3000 in your browser to see it in action.'));
          await sleep(300);
          await streamLog(styles.code('\nHappy coding! 🚀'));
        } catch (error: any) {
          step6.fail('Failed to start development server');
          if (getOptions().debug) {
            console.error(theme.error('Error details:'), error.message);
          }
          process.exit(1);
        }

      } catch (error: any) {
        console.error(theme.error('\n❌ Setup failed:'), error.message || 'Unknown error');
        process.exit(1);
      }
    });

  return auth;
}

async function getWorkspaceAndDatabase(options: GlobalOptions): Promise<{ workspaceSlug: string; databaseName: string }> {
  const configManager = new ConfigManager(options);
  const workspaceSlug = configManager.getWorkspace();
  if (!workspaceSlug) {
    throw new Error('No workspace specified. Use one of:\n' +
      '1. --workspace flag\n' +
      '2. nile config --workspace <name>\n' +
      '3. NILE_WORKSPACE environment variable');
  }

  const databaseName = configManager.getDatabase();
  if (!databaseName) {
    throw new Error('No database specified. Use one of:\n' +
      '1. --db flag\n' +
      '2. nile config --db <name>\n' +
      '3. NILE_DB environment variable');
  }

  return { workspaceSlug, databaseName };
} 