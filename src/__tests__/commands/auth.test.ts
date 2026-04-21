import { Command } from 'commander';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createAuthCommand } from '../../commands/auth';
import { NileAPI } from '../../lib/api';
import { ConfigManager } from '../../lib/config';
import { GlobalOptions } from '../../lib/globalOptions';
import { execSync } from 'child_process';

jest.mock('../../lib/api');
jest.mock('../../lib/config');
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

describe('Auth Command', () => {
  let mockNileAPI: jest.Mocked<any>;
  let globalOptions: GlobalOptions;
  let program: Command;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => true);
    jest.spyOn(console, 'error').mockImplementation(() => true);
    jest.clearAllMocks();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nile-auth-command-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    globalOptions = {
      workspace: 'test-workspace',
      db: 'selected-db',
      debug: false
    };

    mockNileAPI = {
      createDatabaseCredentials: jest.fn().mockResolvedValue({
        id: 'generated-user',
        password: 'generated-secret'
      }),
      getDatabaseConnection: jest.fn().mockResolvedValue({
        host: 'db.thenile.dev',
        port: 5432,
        database: 'selected-db',
        user: 'postgres-user',
        password: 'postgres-password'
      })
    };
    (NileAPI as unknown as jest.Mock).mockImplementation(() => mockNileAPI);

    (ConfigManager as unknown as jest.Mock).mockImplementation(() => ({
      getWorkspace: jest.fn().mockReturnValue(globalOptions.workspace),
      getDatabase: jest.fn().mockReturnValue(globalOptions.db),
      getToken: jest.fn().mockReturnValue('test-token'),
      getDbHost: jest.fn().mockReturnValue('db.thenile.dev'),
      getGlobalHost: jest.fn().mockReturnValue('global.thenile.dev')
    }));

    program = new Command();
    program.addCommand(createAuthCommand(() => globalOptions));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('uses the selected database for auth env and preserves unrelated env vars', async () => {
    fs.writeFileSync('.env.local', 'EXISTING_KEY=keep-me\n');

    await program.parseAsync(['node', 'test', 'auth', 'env', '--output', '.env.local']);

    expect(mockNileAPI.createDatabaseCredentials).toHaveBeenCalledWith('test-workspace', 'selected-db');
    expect(mockNileAPI.getDatabaseConnection).toHaveBeenCalledWith('test-workspace', 'selected-db');

    const envContent = fs.readFileSync('.env.local', 'utf-8');
    expect(envContent).toContain('EXISTING_KEY=keep-me');
    expect(envContent).toContain('NILE_DATABASE_URL=postgres://postgres-user:postgres-password@db.thenile.dev:5432/selected-db');
    expect(envContent).toContain('NILE_WORKSPACE=test-workspace');
    expect(envContent).toContain('NILE_API_KEY=generated-user');
    expect(envContent).toContain('NILE_API_SECRET=generated-secret');
  });

  it('quickstart uses the selected database and only wraps the layout once', async () => {
    fs.writeFileSync('package.json', JSON.stringify({ name: 'demo-app' }, null, 2));
    fs.mkdirSync(path.join('src', 'app'), { recursive: true });
    fs.writeFileSync(
      path.join('src', 'app', 'layout.tsx'),
      `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`
    );

    await program.parseAsync(['node', 'test', 'auth', 'quickstart', '--nextjs']);

    const firstLayout = fs.readFileSync(path.join('src', 'app', 'layout.tsx'), 'utf-8');
    expect(firstLayout.match(/import \{ AuthProvider \} from '@\/components\/AuthProvider';/g)?.length).toBe(1);
    expect(firstLayout.match(/<AuthProvider>/g)?.length).toBe(1);
    expect(firstLayout.match(/<\/AuthProvider>/g)?.length).toBe(1);
    expect(mockNileAPI.createDatabaseCredentials).toHaveBeenCalledWith('test-workspace', 'selected-db');
    expect(mockNileAPI.getDatabaseConnection).toHaveBeenCalledWith('test-workspace', 'selected-db');
    expect(execSync).toHaveBeenCalledWith('npm install @niledatabase/react @niledatabase/server', { stdio: 'inherit' });

    program = new Command();
    program.addCommand(createAuthCommand(() => globalOptions));
    await program.parseAsync(['node', 'test', 'auth', 'quickstart', '--nextjs']);

    const secondLayout = fs.readFileSync(path.join('src', 'app', 'layout.tsx'), 'utf-8');
    expect(secondLayout.match(/import \{ AuthProvider \} from '@\/components\/AuthProvider';/g)?.length).toBe(1);
    expect(secondLayout.match(/<AuthProvider>/g)?.length).toBe(1);
    expect(secondLayout.match(/<\/AuthProvider>/g)?.length).toBe(1);

    const envContent = fs.readFileSync('.env.local', 'utf-8');
    expect(envContent.match(/NILE_DATABASE_URL=/g)?.length).toBe(1);
    expect(fs.existsSync(path.join('src', 'app', 'api', 'auth', 'route.ts'))).toBe(true);
    expect(fs.existsSync(path.join('src', 'components', 'AuthProvider.tsx'))).toBe(true);
  });
});
