import { Command } from 'commander';
import { ConfigManager } from '../lib/config';
import { NileAPI } from '../lib/api';
import { theme, formatCommand } from '../lib/colors';
import { GlobalOptions, getGlobalOptionsHelp } from '../lib/globalOptions';
import { handleApiError } from '../lib/errorHandling';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

type GetOptions = () => GlobalOptions;

export function createAuthCommand(getOptions: GetOptions): Command {
  const auth = new Command('auth')
    .description('Manage authentication')
    .addHelpText('after', `
Examples:
  ${formatCommand('nile auth quickstart --nextjs')}                    Set up authentication in a Next.js app
  ${formatCommand('nile auth env')}                                   Generate environment variables
  ${formatCommand('nile auth env --output .env.local')}              Save environment variables to file

${getGlobalOptionsHelp()}`);

  auth
    .command('quickstart')
    .description('Set up authentication in your application')
    .requiredOption('--nextjs', 'Set up authentication in a Next.js application')
    .action(async (cmdOptions) => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager(options);
        const workspaceSlug = configManager.getWorkspace();
        if (!workspaceSlug) {
          throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <name>\n' +
            '3. NILE_WORKSPACE environment variable');
        }

        const api = new NileAPI({
          token: configManager.getToken(),
          dbHost: configManager.getDbHost(),
          controlPlaneUrl: configManager.getGlobalHost(),
          debug: options.debug
        });

        if (cmdOptions.nextjs) {
          console.log(theme.primary('\nSetting up authentication in Next.js application...'));

          // Create Next.js app if it doesn't exist
          if (!fs.existsSync('package.json')) {
            console.log(theme.dim('\nCreating new Next.js application...'));
            execSync('npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"', { stdio: 'inherit' });
          }

          // Install required dependencies
          console.log(theme.dim('\nInstalling required dependencies...'));
          execSync('npm install @niledatabase/react @niledatabase/server', { stdio: 'inherit' });

          // Get database credentials
          console.log(theme.dim('\nFetching database credentials...'));
          const credentials = await api.createDatabaseCredentials(workspaceSlug, 'test');
          const connection = await api.getDatabaseConnection(workspaceSlug, 'test');

          // Create environment variables
          const envVars = {
            NILE_DATABASE_URL: `postgres://${connection.user}:${connection.password}@${connection.host}:${connection.port}/${connection.database}`,
            NILE_WORKSPACE: workspaceSlug,
            NILE_API_KEY: credentials.id,
            NILE_API_SECRET: credentials.password
          };

          // Write to .env.local
          console.log(theme.dim('\nWriting environment variables to .env.local...'));
          const envContent = Object.entries(envVars)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
          fs.writeFileSync('.env.local', envContent);

          // Create API routes
          console.log(theme.dim('\nCreating API routes...'));
          const apiDir = path.join('src', 'app', 'api');
          if (!fs.existsSync(apiDir)) {
            fs.mkdirSync(apiDir, { recursive: true });
          }

          // Create auth route
          const authRoute = path.join(apiDir, 'auth', 'route.ts');
          fs.mkdirSync(path.dirname(authRoute), { recursive: true });
          fs.writeFileSync(authRoute, `
import { Nile } from '@niledatabase/server';
import { NextResponse } from 'next/server';

const nile = new Nile({
  databaseUrl: process.env.NILE_DATABASE_URL,
  apiKey: process.env.NILE_API_KEY,
  apiSecret: process.env.NILE_API_SECRET,
  workspace: process.env.NILE_WORKSPACE
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const user = await nile.auth.signUp({
      email,
      password
    });

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 400 });
  }
}
`);

          // Create auth provider component
          console.log(theme.dim('\nCreating auth provider component...'));
          const componentsDir = path.join('src', 'components');
          if (!fs.existsSync(componentsDir)) {
            fs.mkdirSync(componentsDir, { recursive: true });
          }

          const authProvider = path.join(componentsDir, 'AuthProvider.tsx');
          fs.writeFileSync(authProvider, `
import { NileProvider } from '@niledatabase/react';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <NileProvider
      databaseUrl={process.env.NILE_DATABASE_URL}
      apiKey={process.env.NILE_API_KEY}
      apiSecret={process.env.NILE_API_SECRET}
      workspace={process.env.NILE_WORKSPACE}
    >
      {children}
    </NileProvider>
  );
}
`);

          // Update root layout
          console.log(theme.dim('\nUpdating root layout...'));
          const layoutFile = path.join('src', 'app', 'layout.tsx');
          const layoutContent = fs.readFileSync(layoutFile, 'utf-8');
          const updatedLayout = layoutContent.replace(
            'export default function RootLayout',
            `import { AuthProvider } from '@/components/AuthProvider';\n\nexport default function RootLayout`
          ).replace(
            '<body>',
            '<body>\n      <AuthProvider>'
          ).replace(
            '</body>',
            '      </AuthProvider>\n    </body>'
          );
          fs.writeFileSync(layoutFile, updatedLayout);

          console.log(theme.success('\nAuthentication setup complete!'));
          console.log(theme.secondary('\nNext steps:'));
          console.log('1. Start your Next.js app with "npm run dev"');
          console.log('2. Visit http://localhost:3000 to see your app');
          console.log('3. Use the Nile React components to add authentication UI');
        }
      } catch (error: any) {
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
          await handleApiError(error, 'set up authentication', new ConfigManager(getOptions()));
        } else {
          throw error;
        }
      }
    });

  auth
    .command('env')
    .description('Generate environment variables for authentication')
    .option('--output <file>', 'Output file for environment variables (e.g., .env.local)')
    .action(async (cmdOptions) => {
      try {
        const options = getOptions();
        const configManager = new ConfigManager(options);
        const workspaceSlug = configManager.getWorkspace();
        if (!workspaceSlug) {
          throw new Error('No workspace specified. Use one of:\n' +
            '1. --workspace flag\n' +
            '2. nile config --workspace <name>\n' +
            '3. NILE_WORKSPACE environment variable');
        }

        const api = new NileAPI({
          token: configManager.getToken(),
          dbHost: configManager.getDbHost(),
          controlPlaneUrl: configManager.getGlobalHost(),
          debug: options.debug
        });

        // Get database credentials
        console.log(theme.dim('\nFetching database credentials...'));
        const credentials = await api.createDatabaseCredentials(workspaceSlug, 'test');
        const connection = await api.getDatabaseConnection(workspaceSlug, 'test');

        // Generate environment variables
        const envVars = {
          NILE_DATABASE_URL: `postgres://${connection.user}:${connection.password}@${connection.host}:${connection.port}/${connection.database}`,
          NILE_WORKSPACE: workspaceSlug,
          NILE_API_KEY: credentials.id,
          NILE_API_SECRET: credentials.password
        };

        // Format environment variables
        const envContent = Object.entries(envVars)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');

        // Output to file if specified
        if (cmdOptions.output) {
          console.log(theme.dim(`\nWriting environment variables to ${cmdOptions.output}...`));
          fs.writeFileSync(cmdOptions.output, envContent);
          console.log(theme.success(`\nEnvironment variables written to ${cmdOptions.output}`));
        } else {
          // Display in terminal
          console.log(theme.primary('\nEnvironment variables:'));
          console.log(theme.secondary('\n' + envContent));
        }
      } catch (error: any) {
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.message === 'Token is required')) {
          await handleApiError(error, 'generate environment variables', new ConfigManager(getOptions()));
        } else {
          throw error;
        }
      }
    });

  return auth;
} 