import { Command } from 'commander';
import { NileAPI } from '../../lib/api';
import { Config } from '../../lib/config';
import { getAuthToken } from '../../lib/authUtils';
import { createDbCommand } from '../../commands/db';
import { GlobalOptions } from '../../lib/globalOptions';
import { theme } from '../../lib/colors';
import { EventEmitter } from 'events';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

// Mock dependencies
jest.mock('../../lib/api');
jest.mock('../../lib/config');
jest.mock('../../lib/authUtils');
jest.mock('../../lib/colors', () => ({
  theme: {
    error: (text: string) => text,
    primary: (text: string) => text,
    success: (text: string) => text,
    bold: (text: string) => text,
    info: (text: string) => text,
    secondary: (text: string) => text,
    warning: (text: string) => text,
    dim: (text: string) => text,
    header: (text: string) => text,
    border: (text: string) => text
  },
  table: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    vertical: '│',
    cross: '┼'
  },
  formatStatus: (status: string) => status,
  formatCommand: (command: string, args?: string) => `${command}${args ? ' ' + args : ''}`
}));

describe('DatabaseCommand', () => {
  let program: Command;
  let mockExit: jest.SpyInstance;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    program = new Command();
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`Process.exit called with code: ${code}`);
    });
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock getAuthToken to return a test token
    (getAuthToken as jest.Mock).mockResolvedValue('test-token');

    // Mock Config.getWorkspace to return a test workspace
    (Config.getWorkspace as jest.Mock).mockResolvedValue({
      slug: 'test-workspace',
      name: 'Test Workspace'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const getOptions = (): GlobalOptions => ({
    debug: false,
    globalHost: 'https://api.thenile.dev',
    dbHost: 'db.thenile.dev',
    format: 'human'
  });

  describe('list command', () => {
    it('should list databases successfully', async () => {
      const mockDatabases = [
        { name: 'db1', region: 'AWS_US_WEST_2', status: 'ACTIVE' },
        { name: 'db2', region: 'AWS_US_EAST_1', status: 'CREATING' }
      ];

      (NileAPI.prototype.listDatabases as jest.Mock).mockResolvedValue(mockDatabases);

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'list']);

      expect(NileAPI.prototype.listDatabases).toHaveBeenCalledWith('test-workspace');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining(`Databases in workspace '${theme.bold('Test Workspace')}':`));
    });

    it('should handle empty database list', async () => {
      (NileAPI.prototype.listDatabases as jest.Mock).mockResolvedValue([]);

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining(`No databases found in workspace '${theme.bold('Test Workspace')}'`));
    });

    it('should handle API errors', async () => {
      (NileAPI.prototype.listDatabases as jest.Mock).mockRejectedValue(new Error('API error'));

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'list']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith(theme.error('Failed to list databases:'), new Error('API error'));
    });
  });

  describe('create command', () => {
    it('should create database successfully', async () => {
      const mockDatabase = {
        name: 'test-db',
        region: 'AWS_US_WEST_2',
        status: 'CREATING'
      };

      (NileAPI.prototype.createDatabase as jest.Mock).mockResolvedValue(mockDatabase);

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'create', '--name', 'test-db', '--region', 'AWS_US_WEST_2']);

      expect(NileAPI.prototype.createDatabase).toHaveBeenCalledWith('test-workspace', 'test-db', 'AWS_US_WEST_2');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining(`Database '${theme.bold('test-db')}' created successfully`));
    });

    it('should list regions when no region specified', async () => {
      const mockRegions = ['AWS_US_WEST_2', 'AWS_US_EAST_1'];
      (NileAPI.prototype.listRegions as jest.Mock).mockResolvedValue(mockRegions);

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'create', '--name', 'test-db']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(NileAPI.prototype.listRegions).toHaveBeenCalledWith('test-workspace');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Available regions'));
    });

    it('should handle API errors', async () => {
      (NileAPI.prototype.createDatabase as jest.Mock).mockRejectedValue(new Error('API error'));

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'create', '--name', 'test-db', '--region', 'AWS_US_WEST_2']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith(theme.error('Failed to create database:'), new Error('API error'));
    });
  });

  describe('show command', () => {
    const mockDatabase = {
      name: 'test-db',
      region: 'AWS_US_WEST_2',
      status: 'ACTIVE'
    };

    beforeEach(() => {
      (NileAPI.prototype.getDatabase as jest.Mock).mockResolvedValue(mockDatabase);
    });

    it('should show database details with provided name', async () => {
      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'show', 'test-db']);

      expect(NileAPI.prototype.getDatabase).toHaveBeenCalledWith('test-workspace', 'test-db');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining(`Database '${theme.bold('test-db')}' details:`));
    });

    it('should show database details using selected database', async () => {
      (Config.getDatabase as jest.Mock).mockResolvedValue({ name: 'selected-db' });

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'show']);

      expect(NileAPI.prototype.getDatabase).toHaveBeenCalledWith('test-workspace', 'selected-db');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining(`Database '${theme.bold('test-db')}' details:`));
    });

    it('should handle missing database selection', async () => {
      (Config.getDatabase as jest.Mock).mockResolvedValue(null);

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'show']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith(
        theme.error('Failed to get database details:'),
        new Error('No database specified. Please provide a database name or run "nile db select" first')
      );
    });

    it('should handle API errors', async () => {
      (NileAPI.prototype.getDatabase as jest.Mock).mockRejectedValue(new Error('API error'));

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'show', 'test-db']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith(theme.error('Failed to get database details:'), new Error('API error'));
    });

    it('should output in JSON format', async () => {
      const options = (): GlobalOptions => ({
        ...getOptions(),
        format: 'json'
      });

      const dbCommand = createDbCommand(options);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'show', 'test-db']);

      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(mockDatabase, null, 2));
    });

    it('should output in CSV format', async () => {
      const options = (): GlobalOptions => ({
        ...getOptions(),
        format: 'csv'
      });

      const dbCommand = createDbCommand(options);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'show', 'test-db']);

      expect(mockConsoleLog).toHaveBeenCalledWith('NAME,REGION,STATUS');
      expect(mockConsoleLog).toHaveBeenCalledWith('test-db,AWS_US_WEST_2,ACTIVE');
    });
  });

  describe('delete command', () => {
    beforeEach(() => {
      (NileAPI.prototype.deleteDatabase as jest.Mock).mockResolvedValue(undefined);
    });

    it('should delete database with provided name', async () => {
      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'delete', 'test-db', '--force']);

      expect(NileAPI.prototype.deleteDatabase).toHaveBeenCalledWith('test-workspace', 'test-db');
      expect(mockConsoleLog).toHaveBeenCalledWith(theme.primary(`\nDeleting database '${theme.bold('test-db')}'...`));
      expect(mockConsoleLog).toHaveBeenCalledWith(theme.success('Database deleted successfully.'));
    });

    it('should delete selected database when no name provided', async () => {
      (Config.getDatabase as jest.Mock).mockResolvedValue({ name: 'selected-db' });

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'delete', '--force']);

      expect(NileAPI.prototype.deleteDatabase).toHaveBeenCalledWith('test-workspace', 'selected-db');
      expect(mockConsoleLog).toHaveBeenCalledWith(theme.primary(`\nDeleting database '${theme.bold('selected-db')}'...`));
      expect(mockConsoleLog).toHaveBeenCalledWith(theme.success('Database deleted successfully.'));
    });

    it('should handle missing database selection', async () => {
      (Config.getDatabase as jest.Mock).mockResolvedValue(null);

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'delete', '--force']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith(
        theme.error('Failed to delete database:'),
        new Error('No database specified. Please provide a database name or run "nile db select" first')
      );
    });

    it('should handle API errors', async () => {
      (NileAPI.prototype.deleteDatabase as jest.Mock).mockRejectedValue(new Error('API error'));

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'delete', 'test-db', '--force']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith(theme.error('Failed to delete database:'), new Error('API error'));
    });
  });

  describe('regions command', () => {
    const mockRegions = ['AWS_US_WEST_2', 'AWS_US_EAST_1', 'AWS_EU_WEST_1'];

    beforeEach(() => {
      (NileAPI.prototype.listRegions as jest.Mock).mockResolvedValue(mockRegions);
    });

    it('should list available regions', async () => {
      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'regions']);

      expect(NileAPI.prototype.listRegions).toHaveBeenCalledWith('test-workspace');
      expect(mockConsoleLog).toHaveBeenCalledWith(theme.primary('\nAvailable regions:'));
      mockRegions.forEach(region => {
        expect(mockConsoleLog).toHaveBeenCalledWith(theme.info(`- ${region}`));
      });
    });

    it('should handle empty regions list', async () => {
      (NileAPI.prototype.listRegions as jest.Mock).mockResolvedValue([]);

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'regions']);

      expect(mockConsoleLog).toHaveBeenCalledWith(theme.warning('\nNo regions available.'));
    });

    it('should output in JSON format', async () => {
      const options = (): GlobalOptions => ({
        ...getOptions(),
        format: 'json'
      });

      const dbCommand = createDbCommand(options);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'regions']);

      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(mockRegions, null, 2));
    });

    it('should output in CSV format', async () => {
      const options = (): GlobalOptions => ({
        ...getOptions(),
        format: 'csv'
      });

      const dbCommand = createDbCommand(options);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'regions']);

      expect(mockConsoleLog).toHaveBeenCalledWith('REGION');
      mockRegions.forEach(region => {
        expect(mockConsoleLog).toHaveBeenCalledWith(region);
      });
    });

    it('should handle API errors', async () => {
      (NileAPI.prototype.listRegions as jest.Mock).mockRejectedValue(new Error('API error'));

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'regions']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith(theme.error('Failed to list regions:'), new Error('API error'));
    });
  });

  describe('select command', () => {
    const mockDatabase = {
      name: 'test-db',
      region: 'AWS_US_WEST_2',
      status: 'ACTIVE'
    };

    beforeEach(() => {
      (NileAPI.prototype.getDatabase as jest.Mock).mockResolvedValue(mockDatabase);
      (Config.setDatabase as jest.Mock).mockResolvedValue(undefined);
    });

    it('should select database successfully', async () => {
      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'select', 'test-db']);

      expect(NileAPI.prototype.getDatabase).toHaveBeenCalledWith('test-workspace', 'test-db');
      expect(Config.setDatabase).toHaveBeenCalledWith(mockDatabase);
      expect(mockConsoleLog).toHaveBeenCalledWith(theme.success(`Selected database '${theme.bold('test-db')}'`));
    });

    it('should handle non-existent database', async () => {
      (NileAPI.prototype.getDatabase as jest.Mock).mockRejectedValue(new Error('Database not found'));

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'select', 'non-existent-db']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith(theme.error('Failed to select database:'), new Error('Database not found'));
      expect(Config.setDatabase).not.toHaveBeenCalled();
    });

    it('should handle config errors', async () => {
      (Config.setDatabase as jest.Mock).mockRejectedValue(new Error('Config error'));

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'select', 'test-db']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith(theme.error('Failed to select database:'), new Error('Config error'));
    });
  });

  describe('psql command', () => {
    const mockConnection = {
      user: 'test-user',
      password: 'test-password',
      host: 'test-host',
      port: 5432,
      database: 'test-database'
    };

    beforeEach(() => {
      (NileAPI.prototype.getDatabaseConnection as jest.Mock).mockResolvedValue(mockConnection);
    });

    it('should connect to database with provided name', async () => {
      const mockPsql = new EventEmitter();
      mockPsql.on = jest.fn().mockImplementation((event, callback) => {
        if (event === 'exit') {
          callback(0);
        }
        return mockPsql;
      });
      const { spawn } = require('child_process');
      spawn.mockReturnValue(mockPsql);

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'psql', '--name', 'test-db']);

      expect(NileAPI.prototype.getDatabaseConnection).toHaveBeenCalledWith('test-workspace', 'test-db');
      expect(spawn).toHaveBeenCalledWith(
        'psql',
        [`postgres://${mockConnection.user}:${mockConnection.password}@${mockConnection.host}:${mockConnection.port}/${mockConnection.database}`],
        { stdio: 'inherit' }
      );
    });

    it('should connect to selected database when no name provided', async () => {
      (Config.getDatabase as jest.Mock).mockResolvedValue({ name: 'selected-db' });
      const mockPsql = new EventEmitter();
      mockPsql.on = jest.fn().mockImplementation((event, callback) => {
        if (event === 'exit') {
          callback(0);
        }
        return mockPsql;
      });
      const { spawn } = require('child_process');
      spawn.mockReturnValue(mockPsql);

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'psql']);

      expect(NileAPI.prototype.getDatabaseConnection).toHaveBeenCalledWith('test-workspace', 'selected-db');
    });

    it('should handle missing psql command', async () => {
      const mockPsql = new EventEmitter();
      mockPsql.on = jest.fn().mockImplementation((event, callback) => {
        if (event === 'error') {
          callback({ code: 'ENOENT' });
        }
        return mockPsql;
      });
      const { spawn } = require('child_process');
      spawn.mockReturnValue(mockPsql);

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'psql', '--name', 'test-db']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith(
        theme.error('\nError: psql command not found. Please install PostgreSQL client tools.')
      );
    });

    it('should handle psql execution errors', async () => {
      const mockPsql = new EventEmitter();
      mockPsql.on = jest.fn().mockImplementation((event, callback) => {
        if (event === 'error') {
          callback(new Error('Execution error'));
        }
        return mockPsql;
      });
      const { spawn } = require('child_process');
      spawn.mockReturnValue(mockPsql);

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'psql', '--name', 'test-db']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith(theme.error('\nError executing psql:'), new Error('Execution error'));
    });

    it('should handle non-zero exit codes', async () => {
      const mockPsql = new EventEmitter();
      mockPsql.on = jest.fn().mockImplementation((event, callback) => {
        if (event === 'exit') {
          callback(1);
        }
        return mockPsql;
      });
      const { spawn } = require('child_process');
      spawn.mockReturnValue(mockPsql);

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'psql', '--name', 'test-db']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith(theme.error('\npsql exited with code:'), 1);
    });
  });

  describe('connectionstring command', () => {
    const mockConnection = {
      user: 'test-user',
      password: 'test-password',
      host: 'test-host',
      port: 5432,
      database: 'test-database'
    };

    beforeEach(() => {
      (NileAPI.prototype.getDatabaseConnection as jest.Mock).mockResolvedValue(mockConnection);
    });

    it('should show connection string with provided name', async () => {
      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'connectionstring', '--name', 'test-db', '--psql']);

      expect(NileAPI.prototype.getDatabaseConnection).toHaveBeenCalledWith('test-workspace', 'test-db');
      const connectionString = `postgres://${mockConnection.user}:${mockConnection.password}@${mockConnection.host}:${mockConnection.port}/${mockConnection.database}`;
      expect(mockConsoleLog).toHaveBeenCalledWith(connectionString);
    });

    it('should show connection string for selected database', async () => {
      (Config.getDatabase as jest.Mock).mockResolvedValue({ name: 'selected-db' });

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await program.parseAsync(['node', 'test', 'db', 'connectionstring', '--psql']);

      expect(NileAPI.prototype.getDatabaseConnection).toHaveBeenCalledWith('test-workspace', 'selected-db');
    });

    it('should handle missing database selection', async () => {
      (Config.getDatabase as jest.Mock).mockResolvedValue(null);

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'connectionstring', '--psql']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith(
        theme.error('Failed to get connection string:'),
        new Error('No database specified. Please provide --name option or run "nile db select" first')
      );
    });

    it('should handle API errors', async () => {
      (NileAPI.prototype.getDatabaseConnection as jest.Mock).mockRejectedValue(new Error('API error'));

      const dbCommand = createDbCommand(getOptions);
      program.addCommand(dbCommand);

      await expect(program.parseAsync(['node', 'test', 'db', 'connectionstring', '--name', 'test-db', '--psql']))
        .rejects.toThrow('Process.exit called with code: 1');

      expect(mockConsoleError).toHaveBeenCalledWith(theme.error('Failed to get connection string:'), new Error('API error'));
    });
  });
}); 