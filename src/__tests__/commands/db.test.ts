import { Command } from 'commander';
import { createDbCommand } from '../../commands/db';
import { NileAPI } from '../../lib/api';
import { ConfigManager } from '../../lib/config';
import { GlobalOptions } from '../../lib/globalOptions';
import { theme } from '../../lib/colors';
import { EventEmitter } from 'events';

// Custom error class for process.exit
class ProcessExitError extends Error {
  constructor(code: number | string | null | undefined) {
    super(`Process.exit called with code: ${code}`);
    this.name = 'ProcessExitError';
  }
}

// Helper functions for testing
const expectProcessExit = (error: unknown) => {
  expect(error).toBeInstanceOf(ProcessExitError);
  if (error instanceof ProcessExitError) {
    expect(error.message).toBe('Process.exit called with code: 1');
  }
};

// Mock dependencies
jest.mock('pg');
jest.mock('../../lib/api');
jest.mock('../../lib/config');
jest.mock('../../lib/auth');
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

describe('DB Command', () => {
  let mockNileAPI: jest.Mocked<any>;
  let mockConfigManager: jest.Mocked<any>;
  let program: Command;
  let mockExit: jest.SpyInstance;
  let mockSpawn: jest.Mock;
  let globalOptions: GlobalOptions;

  beforeEach(() => {
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => true);
    jest.spyOn(console, 'error').mockImplementation(() => true);
    jest.clearAllMocks();

    // Setup global options with debug mode off by default
    globalOptions = {
      workspace: 'test-workspace',
      db: 'test-db',
      debug: false,
      format: undefined
    };

    // Mock process.exit
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new ProcessExitError(code);
    });

    // Setup mock NileAPI
    mockNileAPI = {
      listDatabases: jest.fn(),
      createDatabase: jest.fn(),
      deleteDatabase: jest.fn(),
      getDatabase: jest.fn(),
      listRegions: jest.fn(),
      getDatabaseConnection: jest.fn(),
    };
    (NileAPI as unknown as jest.Mock).mockImplementation(() => mockNileAPI);

    // Setup mock ConfigManager
    mockConfigManager = {
      getWorkspace: jest.fn().mockReturnValue('test-workspace'),
      getDatabase: jest.fn().mockReturnValue('test-db'),
      getToken: jest.fn().mockReturnValue('test-token'),
      getDbHost: jest.fn().mockReturnValue('test-db-host'),
      getGlobalHost: jest.fn().mockReturnValue('test-global-host'),
      getBaseUrl: jest.fn(),
    };
    (ConfigManager as unknown as jest.Mock).mockImplementation(() => mockConfigManager);

    // Get the mock spawn function
    mockSpawn = jest.requireMock('child_process').spawn;

    // Setup program
    program = new Command();
    program.addCommand(createDbCommand(() => globalOptions));

    // Set up default mock implementations
    mockNileAPI.listDatabases.mockResolvedValue([
      { name: 'db1', region: 'AWS_US_WEST_2', status: 'ACTIVE' },
      { name: 'db2', region: 'AWS_US_EAST_1', status: 'CREATING' }
    ]);
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  describe('list command', () => {
    it('should list databases successfully', async () => {
      await program.parseAsync(['node', 'test', 'db', 'list']);
      const calls = (console.log as jest.Mock).mock.calls;
      const output = calls.map(call => call[0]).join('\n');
      expect(output).toContain(`Databases in workspace '${theme.bold('test-workspace')}'`);
      expect(mockNileAPI.listDatabases).toHaveBeenCalledWith('test-workspace');
    });

    it('should handle empty database list', async () => {
      mockNileAPI.listDatabases.mockResolvedValueOnce([]);
      await program.parseAsync(['node', 'test', 'db', 'list']);
      const calls = (console.log as jest.Mock).mock.calls;
      const output = calls.map(call => call[0]).join('\n');
      expect(output).toContain(theme.warning(`\nNo databases found in workspace '${theme.bold('test-workspace')}'`));
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockNileAPI.listDatabases.mockRejectedValueOnce(error);
      try {
        await program.parseAsync(['node', 'test', 'db', 'list']);
        fail('Should have thrown an error');
      } catch (e) {
        expect(e).toBeInstanceOf(ProcessExitError);
        expect(console.error).toHaveBeenCalledWith(
          theme.error('Failed to list databases:'),
          'API Error'
        );
      }
    });

    it('should output in JSON format', async () => {
      globalOptions.format = 'json';
      await program.parseAsync(['node', 'test', 'db', 'list']);
      expect(console.log).toHaveBeenCalledWith(JSON.stringify([
        { name: 'db1', region: 'AWS_US_WEST_2', status: 'ACTIVE' },
        { name: 'db2', region: 'AWS_US_EAST_1', status: 'CREATING' }
      ], null, 2));
    });

    it('should output in CSV format', async () => {
      globalOptions.format = 'csv';
      await program.parseAsync(['node', 'test', 'db', 'list']);
      expect(console.log).toHaveBeenCalledWith('NAME,REGION,STATUS');
      expect(console.log).toHaveBeenCalledWith('db1,AWS_US_WEST_2,ACTIVE');
      expect(console.log).toHaveBeenCalledWith('db2,AWS_US_EAST_1,CREATING');
    });
  });

  describe('create command', () => {
    let mockStderrWrite: jest.SpyInstance;

    beforeEach(() => {
      mockStderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      mockStderrWrite.mockRestore();
    });

    it('should create database successfully', async () => {
      mockNileAPI.createDatabase.mockResolvedValue({
        name: 'test-db',
        region: 'AWS_US_WEST_2',
        status: 'CREATING'
      });

      await program.parseAsync(['node', 'test', 'db', 'create', '--name', 'test-db', '--region', 'AWS_US_WEST_2']);

      expect(mockNileAPI.createDatabase).toHaveBeenCalledWith('test-workspace', 'test-db', 'AWS_US_WEST_2');
      const calls = (console.log as jest.Mock).mock.calls;
      const output = calls.map(call => call[0]).join('\n');
      expect(output).toContain(`Database '${theme.bold('test-db')}' created successfully`);
    });

    it('should require name option', async () => {
      try {
        await program.parseAsync(['node', 'test', 'db', 'create', '--region', 'AWS_US_WEST_2']);
      } catch (error) {
        expectProcessExit(error);
      }
      
      const stderrCalls = mockStderrWrite.mock.calls;
      const stderrOutput = stderrCalls.map(call => call[0]).join('');
      expect(stderrOutput).toContain("error: required option '--name <n>' not specified");
    });

    it('should require region option', async () => {
      try {
        await program.parseAsync(['node', 'test', 'db', 'create', '--name', 'test-db']);
      } catch (error) {
        expectProcessExit(error);
      }
      
      const stderrCalls = mockStderrWrite.mock.calls;
      const stderrOutput = stderrCalls.map(call => call[0]).join('');
      expect(stderrOutput).toContain("error: required option '--region <r>' not specified");
    });

    it('should handle API errors', async () => {
      mockNileAPI.createDatabase.mockRejectedValue(new Error('API error'));

      try {
        await program.parseAsync(['node', 'test', 'db', 'create', '--name', 'test-db', '--region', 'AWS_US_WEST_2']);
      } catch (error) {
        expectProcessExit(error);
      }

      expect(console.error).toHaveBeenCalledWith(theme.error('Failed to create database:'), 'API error');
    });
  });

  describe('show command', () => {
    it('should show database details with provided name', async () => {
      mockNileAPI.getDatabase.mockResolvedValue({
        name: 'test-db',
        region: 'AWS_US_WEST_2',
        status: 'ACTIVE'
      });

      await program.parseAsync(['node', 'test', 'db', 'show', 'test-db']);

      expect(mockNileAPI.getDatabase).toHaveBeenCalledWith('test-workspace', 'test-db');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Database details:'));
    });

    it('should output in JSON format', async () => {
      globalOptions.format = 'json';
      mockNileAPI.getDatabase.mockResolvedValue({
        name: 'test-db',
        region: 'AWS_US_WEST_2',
        status: 'ACTIVE'
      });

      await program.parseAsync(['node', 'test', 'db', 'show', 'test-db']);

      expect(console.log).toHaveBeenCalledWith(JSON.stringify({
        name: 'test-db',
        region: 'AWS_US_WEST_2',
        status: 'ACTIVE'
      }, null, 2));
    });

    it('should output in CSV format', async () => {
      globalOptions.format = 'csv';
      mockNileAPI.getDatabase.mockResolvedValue({
        name: 'test-db',
        region: 'AWS_US_WEST_2',
        status: 'ACTIVE'
      });

      await program.parseAsync(['node', 'test', 'db', 'show', 'test-db']);

      expect(console.log).toHaveBeenCalledWith('NAME,REGION,STATUS');
      expect(console.log).toHaveBeenCalledWith('test-db,AWS_US_WEST_2,ACTIVE');
    });
  });

  describe('delete command', () => {
    it('should delete database with provided name', async () => {
      mockNileAPI.deleteDatabase.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'db', 'delete', 'test-db', '--force']);

      expect(mockNileAPI.deleteDatabase).toHaveBeenCalledWith('test-workspace', 'test-db');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Database deleted successfully'));
    });

    it('should require database name', async () => {
      mockConfigManager.getDatabase.mockReturnValue(undefined);

      try {
        await program.parseAsync(['node', 'test', 'db', 'delete']);
      } catch (error) {
        expectProcessExit(error);
      }

      const actualError = (console.error as jest.Mock).mock.calls[0][1];
      expect(console.error).toHaveBeenCalledWith(
        theme.error('Failed to delete database:'),
        expect.stringContaining('No database specified')
      );
      expect(actualError).toContain('No database specified');
    });

    it('should handle API errors', async () => {
      mockNileAPI.deleteDatabase.mockRejectedValue(new Error('API error'));

      try {
        await program.parseAsync(['node', 'test', 'db', 'delete', 'test-db', '--force']);
      } catch (error) {
        expectProcessExit(error);
      }

      expect(console.error).toHaveBeenCalledWith(theme.error('Failed to delete database:'), 'API error');
    });
  });

  describe('regions command', () => {
    it('should list available regions', async () => {
      mockNileAPI.listRegions.mockResolvedValue(['AWS_US_WEST_2', 'AWS_US_EAST_1']);

      await program.parseAsync(['node', 'test', 'db', 'regions']);

      expect(mockNileAPI.listRegions).toHaveBeenCalledWith('test-workspace');
      expect(console.log).toHaveBeenCalledWith(theme.primary('\nAvailable regions:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('AWS_US_WEST_2'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('AWS_US_EAST_1'));
    });

    it('should output in JSON format', async () => {
      globalOptions.format = 'json';
      mockNileAPI.listRegions.mockResolvedValue(['AWS_US_WEST_2', 'AWS_US_EAST_1']);

      await program.parseAsync(['node', 'test', 'db', 'regions']);

      expect(console.log).toHaveBeenCalledWith(JSON.stringify(['AWS_US_WEST_2', 'AWS_US_EAST_1'], null, 2));
    });

    it('should output in CSV format', async () => {
      globalOptions.format = 'csv';
      mockNileAPI.listRegions.mockResolvedValue(['AWS_US_WEST_2', 'AWS_US_EAST_1']);

      await program.parseAsync(['node', 'test', 'db', 'regions']);

      expect(console.log).toHaveBeenCalledWith('REGION');
      expect(console.log).toHaveBeenCalledWith('AWS_US_WEST_2');
      expect(console.log).toHaveBeenCalledWith('AWS_US_EAST_1');
    });

    it('should handle API errors', async () => {
      mockNileAPI.listRegions.mockRejectedValue(new Error('API error'));

      try {
        await program.parseAsync(['node', 'test', 'db', 'regions']);
      } catch (error) {
        expectProcessExit(error);
      }

      expect(console.error).toHaveBeenCalledWith(theme.error('Failed to list regions:'), 'API error');
    });
  });

  describe('psql command', () => {
    it('should handle non-zero exit codes', async () => {
      const mockPsql = new EventEmitter();
      mockSpawn.mockReturnValue(mockPsql);
      mockNileAPI.getDatabaseConnection.mockResolvedValue({
        host: 'host',
        database: 'db',
        user: 'user',
        password: 'pass',
        port: 5432
      });

      const promise = program.parseAsync(['node', 'test', 'db', 'psql', '--name', 'test-db']);
      mockPsql.emit('close', 1);
      try {
        await promise;
      } catch (error) {
        expectProcessExit(error);
      }
    });
  });

  describe('connectionstring command', () => {
    it('should show connection string with provided name', async () => {
      mockNileAPI.getDatabaseConnection.mockResolvedValue({
        host: 'host',
        database: 'db',
        user: 'user',
        password: 'pass',
        port: 5432
      });

      await program.parseAsync(['node', 'test', 'db', 'connectionstring', '--name', 'test-db', '--psql']);

      expect(mockNileAPI.getDatabaseConnection).toHaveBeenCalledWith('test-workspace', 'test-db');
      expect(console.log).toHaveBeenCalledWith('postgres://user:pass@host:5432/db');
    });

    it('should require database name', async () => {
      mockConfigManager.getDatabase.mockReturnValue(undefined);
      mockNileAPI.getDatabaseConnection.mockImplementation(() => {
        throw new Error('No database specified. Use one of:\n1. --db flag\n2. nile config --db <n>\n3. NILE_DB environment variable');
      });

      try {
        await program.parseAsync(['node', 'test', 'db', 'connectionstring', '--psql']);
      } catch (error) {
        expectProcessExit(error);
      }

      const actualError = (console.error as jest.Mock).mock.calls[0][1];
      expect(console.error).toHaveBeenCalledWith(
        theme.error('Failed to get connection string:'),
        expect.stringContaining('No database specified')
      );
      expect(actualError).toContain('No database specified');
    });

    it('should require --psql flag', async () => {
      const stderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        await program.parseAsync(['node', 'test', 'db', 'connectionstring', '--name', 'test-db']);
      } catch (error) {
        expectProcessExit(error);
      }

      const stderrOutput = stderrWrite.mock.calls.map(call => call[0]).join('');
      expect(stderrOutput).toContain("error: required option '--psql' not specified");
      stderrWrite.mockRestore();
    });

    it('should require workspace', async () => {
      mockConfigManager.getWorkspace.mockReturnValue(undefined);
      mockConfigManager.getDatabase.mockReturnValue('test-db');

      try {
        await program.parseAsync(['node', 'test', 'db', 'connectionstring', '--name', 'test-db', '--psql']);
      } catch (error) {
        expectProcessExit(error);
      }

      const actualError = (console.error as jest.Mock).mock.calls[0][1];
      expect(console.error).toHaveBeenCalledWith(
        theme.error('Failed to get connection string:'),
        expect.stringContaining('No workspace specified')
      );
      expect(actualError).toContain('No workspace specified');
    });

    it('should handle API errors', async () => {
      mockNileAPI.getDatabaseConnection.mockRejectedValue(new Error('API error'));

      try {
        await program.parseAsync(['node', 'test', 'db', 'connectionstring', '--name', 'test-db', '--psql']);
      } catch (error) {
        expectProcessExit(error);
      }

      expect(console.error).toHaveBeenCalledWith(theme.error('Failed to get connection string:'), 'API error');
    });
  });
}); 