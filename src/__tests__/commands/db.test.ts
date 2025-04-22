import { Command } from 'commander';
import { createDbCommand } from '../../commands/db';
import { NileAPI } from '../../lib/api';
import { ConfigManager } from '../../lib/config';
import { GlobalOptions } from '../../lib/globalOptions';
import { theme } from '../../lib/colors';
import { EventEmitter } from 'events';
import fs from 'fs';

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
      
      await expect(
        program.parseAsync(['node', 'test', 'db', 'list'])
      ).rejects.toThrow('API Error');
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
      expect(output).toContain('test-db');
      expect(output).toContain('AWS_US_WEST_2');
      expect(output).toContain('CREATING');
    });

    it('should require name option', async () => {
      try {
        await program.parseAsync(['node', 'test', 'db', 'create', '--region', 'AWS_US_WEST_2']);
      } catch (error) {
        expectProcessExit(error);
      }
      
      const stderrCalls = mockStderrWrite.mock.calls;
      const stderrOutput = stderrCalls.map(call => call[0]).join('');
      expect(stderrOutput).toContain("error: required option '--name <name>' not specified");
    });

    it('should require region option', async () => {
      try {
        await program.parseAsync(['node', 'test', 'db', 'create', '--name', 'test-db']);
      } catch (error) {
        expectProcessExit(error);
      }
      
      const stderrCalls = mockStderrWrite.mock.calls;
      const stderrOutput = stderrCalls.map(call => call[0]).join('');
      expect(stderrOutput).toContain("error: required option '--region <region>' not specified");
    });

    it('should handle API errors', async () => {
      mockNileAPI.createDatabase.mockRejectedValue(new Error('API error'));

      await expect(
        program.parseAsync(['node', 'test', 'db', 'create', '--name', 'test-db', '--region', 'AWS_US_WEST_2'])
      ).rejects.toThrow('API error');
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
      const calls = (console.log as jest.Mock).mock.calls;
      const output = calls.map(call => call[0]).join('\n');
      expect(output).toContain('test-db');
      expect(output).toContain('AWS_US_WEST_2');
      expect(output).toContain('ACTIVE');
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

      await program.parseAsync(['node', 'test', 'db', 'delete', 'test-db']);

      expect(mockNileAPI.deleteDatabase).toHaveBeenCalledWith('test-workspace', 'test-db');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Database deleted successfully'));
    });

    it('should require database name', async () => {
      await expect(
        program.parseAsync(['node', 'test', 'db', 'delete'])
      ).rejects.toThrow();
    });

    it('should handle API errors', async () => {
      mockNileAPI.deleteDatabase.mockRejectedValue(new Error('API error'));

      await expect(
        program.parseAsync(['node', 'test', 'db', 'delete', 'test-db'])
      ).rejects.toThrow('API error');
    });
  });

  describe('regions command', () => {
    it('should list available regions', async () => {
      mockNileAPI.listRegions.mockResolvedValue(['AWS_US_WEST_2', 'AWS_US_EAST_1']);

      await program.parseAsync(['node', 'test', 'db', 'regions']);

      expect(mockNileAPI.listRegions).toHaveBeenCalledWith('test-workspace');
      const calls = (console.log as jest.Mock).mock.calls;
      const output = calls.map(call => call[0]).join('\n');
      expect(output).toContain('NAME');
      expect(output).toContain('AWS_US_WEST_2');
      expect(output).toContain('AWS_US_EAST_1');
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

      expect(console.log).toHaveBeenCalledWith('NAME');
      expect(console.log).toHaveBeenCalledWith('AWS_US_WEST_2');
      expect(console.log).toHaveBeenCalledWith('AWS_US_EAST_1');
    });

    it('should handle API errors', async () => {
      mockNileAPI.listRegions.mockRejectedValue(new Error('API error'));

      await expect(
        program.parseAsync(['node', 'test', 'db', 'regions'])
      ).rejects.toThrow('API error');
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
      await expect(
        program.parseAsync(['node', 'test', 'db', 'connectionstring'])
      ).rejects.toThrow();
    });

    it('should require workspace', async () => {
      mockConfigManager.getWorkspace.mockReturnValue(undefined);

      await expect(
        program.parseAsync(['node', 'test', 'db', 'connectionstring', 'test-db'])
      ).rejects.toThrow();
    });

    it('should handle API errors', async () => {
      mockNileAPI.getDatabaseConnection.mockRejectedValue(new Error('API error'));

      await expect(
        program.parseAsync(['node', 'test', 'db', 'connectionstring', 'test-db', '--psql'])
      ).rejects.toThrow('API error');
    });
  });

  describe('copy command', () => {
    let mockClient: any;
    let mockConnect: jest.Mock;
    let mockQuery: jest.Mock;
    let mockEnd: jest.Mock;
    let mockFs: any;
    let mockConsoleError: jest.SpyInstance;

    beforeEach(() => {
      // Mock console.error instead of stderr
      mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock the pg Client
      mockQuery = jest.fn();
      mockConnect = jest.fn();
      mockEnd = jest.fn();
      mockClient = {
        connect: mockConnect,
        query: mockQuery,
        end: mockEnd
      };
      const { Client } = require('pg');
      Client.mockImplementation(() => mockClient);

      // Mock fs
      mockFs = {
        existsSync: jest.fn().mockReturnValue(true),
        readFileSync: jest.fn().mockReturnValue('id,name,price,tenant_id\n1,Product 1,10.99,tenant1\n2,Product 2,20.99,tenant2')
      };
      jest.spyOn(fs, 'existsSync').mockImplementation(mockFs.existsSync);
      jest.spyOn(fs, 'readFileSync').mockImplementation(mockFs.readFileSync);

      // Mock database connection response
      mockNileAPI.getDatabaseConnection.mockResolvedValue({
        host: 'test-host',
        database: 'test-db',
        user: 'test-user',
        password: 'test-password',
        port: 5432
      });

      // Mock successful table check query
      mockQuery.mockResolvedValueOnce({ rows: [{ column_name: 'tenant_id' }] });
    });

    afterEach(() => {
      mockConsoleError.mockRestore();
      jest.clearAllMocks();
    });

    it('should copy data from CSV file successfully', async () => {
      // Mock successful transaction
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // First insert
        .mockResolvedValueOnce({ rows: [] }) // Second insert
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await program.parseAsync([
        'node', 'test', 'db', 'copy',
        '--table-name', 'products',
        '--file-name', 'test.csv',
        '--format', 'csv'
      ]);

      expect(mockConnect).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO products'));
      expect(mockEnd).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Copy operation completed successfully'));
    });

    it('should handle missing file error', async () => {
      mockFs.existsSync.mockReturnValueOnce(false);

      try {
        await program.parseAsync([
          'node', 'test', 'db', 'copy',
          '--table-name', 'products',
          '--file-name', 'nonexistent.csv',
          '--format', 'csv'
        ]);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessExitError);
        const calls = mockConsoleError.mock.calls;
        expect(calls.length).toBe(1);
        expect(calls[0][0]).toContain('Failed');
        expect(calls[0][0]).toContain('copy');
        expect(calls[0][1]).toBeInstanceOf(Error);
        expect(calls[0][1].message).toContain('File');
        expect(calls[0][1].message).toContain('not found');
      }
    });

    it('should handle invalid format error', async () => {
      try {
        await program.parseAsync([
          'node', 'test', 'db', 'copy',
          '--table-name', 'products',
          '--file-name', 'test.csv',
          '--format', 'invalid'
        ]);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessExitError);
        const calls = mockConsoleError.mock.calls;
        expect(calls.length).toBe(1);
        expect(calls[0][0]).toContain('Failed');
        expect(calls[0][0]).toContain('copy');
        expect(calls[0][1]).toBeInstanceOf(Error);
        expect(calls[0][1].message).toContain('Format');
        expect(calls[0][1].message).toContain('csv');
        expect(calls[0][1].message).toContain('text');
      }
    });

    it('should handle database error during copy', async () => {
      // Set up the error scenario
      mockQuery
        .mockResolvedValueOnce({ rows: [{ column_name: 'tenant_id' }] }) // Table check
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')) // Insert fails
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      try {
        await program.parseAsync([
          'node', 'test', 'db', 'copy',
          '--table-name', 'products',
          '--file-name', 'test.csv',
          '--format', 'csv'
        ]);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessExitError);
        expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
        expect(mockConsoleError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to copy data:'),
          expect.objectContaining({ message: 'Database error' })
        );
      }
    });

    it('should support text format with custom delimiter', async () => {
      mockFs.readFileSync.mockReturnValueOnce('id\tname\tprice\ttenant_id\n1\tProduct 1\t10.99\ttenant1');

      // Mock successful transaction
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Insert
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await program.parseAsync([
        'node', 'test', 'db', 'copy',
        '--table-name', 'products',
        '--file-name', 'test.txt',
        '--format', 'text',
        '--delimiter', '\t'
      ]);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO products'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Copy operation completed successfully'));
    });
  });
}); 