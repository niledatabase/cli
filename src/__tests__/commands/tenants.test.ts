import { Command } from 'commander';
import { Client } from 'pg';
import { TenantsCommand } from '../../commands/tenants';
import { NileAPI } from '../../lib/api';
import { Config } from '../../lib/config';
import { getAuthToken } from '../../lib/authUtils';

// Mock dependencies
jest.mock('pg');
jest.mock('../../lib/api');
jest.mock('../../lib/config');
jest.mock('../../lib/authUtils');

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('Process.exit called with code: 1');
}) as jest.SpyInstance;

describe('Tenants Command', () => {
  let program: Command;
  let mockClient: jest.Mocked<Client>;
  let mockNileAPI: jest.Mocked<NileAPI>;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup mock pg client
    mockClient = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
    } as unknown as jest.Mocked<Client>;
    (Client as unknown as jest.Mock).mockImplementation(() => mockClient);

    // Setup mock NileAPI
    mockNileAPI = {
      createDatabaseCredentials: jest.fn().mockResolvedValue({
        id: 'test-user',
        password: 'test-pass',
        database: {
          region: 'AWS_US_WEST_2'
        }
      })
    } as unknown as jest.Mocked<NileAPI>;
    (NileAPI as unknown as jest.Mock).mockImplementation(() => mockNileAPI);

    // Mock Config and auth
    (Config.getWorkspace as jest.Mock).mockResolvedValue({ slug: 'test-workspace' });
    (Config.getDatabase as jest.Mock).mockResolvedValue({ name: 'test-db' });
    (getAuthToken as jest.Mock).mockResolvedValue('test-token');
    
    // Setup program
    program = new Command();
    new TenantsCommand(program, () => ({}));
  });

  afterAll(() => {
    mockExit.mockRestore();
  });

  describe('list command', () => {
    it('should list all tenants', async () => {
      const mockTenants = [
        { id: 'tenant-1', name: 'Tenant 1' },
        { id: 'tenant-2', name: 'Tenant 2' }
      ];
      
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: mockTenants });

      await program.parseAsync(['node', 'test', 'tenants', 'list']);

      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM tenants');
      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should handle empty tenant list', async () => {
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await program.parseAsync(['node', 'test', 'tenants', 'list']);

      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.end).toHaveBeenCalled();
    });
  });

  describe('create command', () => {
    it('should create a tenant with auto-generated ID', async () => {
      const mockTenant = { id: 'auto-id', name: 'New Tenant' };
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [mockTenant] });

      await program.parseAsync(['node', 'test', 'tenants', 'create', '--name', 'New Tenant']);

      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO tenants (name) VALUES ($1) RETURNING *',
        ['New Tenant']
      );
      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should create a tenant with custom ID', async () => {
      const mockTenant = { id: 'custom-id', name: 'New Tenant' };
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [mockTenant] });

      await program.parseAsync([
        'node', 'test', 'tenants', 'create',
        '--name', 'New Tenant',
        '--id', 'custom-id'
      ]);

      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO tenants (id, name) VALUES ($1, $2) RETURNING *',
        ['custom-id', 'New Tenant']
      );
      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should handle creation error', async () => {
      (mockClient.query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      await expect(
        program.parseAsync(['node', 'test', 'tenants', 'create', '--name', 'New Tenant'])
      ).rejects.toThrow('Process.exit called with code: 1');

      expect(mockClient.end).toHaveBeenCalled();
    });
  });

  describe('update command', () => {
    it('should update tenant name', async () => {
      const mockTenant = { id: 'tenant-1', name: 'Updated Name' };
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [mockTenant], rowCount: 1 });

      await program.parseAsync([
        'node', 'test', 'tenants', 'update',
        '--id', 'tenant-1',
        '--new_name', 'Updated Name'
      ]);

      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE tenants SET name = $1 WHERE id = $2 RETURNING *',
        ['Updated Name', 'tenant-1']
      );
      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should handle non-existent tenant', async () => {
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(
        program.parseAsync([
          'node', 'test', 'tenants', 'update',
          '--id', 'non-existent',
          '--new_name', 'New Name'
        ])
      ).rejects.toThrow('Process.exit called with code: 1');

      expect(mockClient.end).toHaveBeenCalled();
    });
  });

  describe('delete command', () => {
    it('should delete tenant', async () => {
      const mockTenant = { id: 'tenant-1', name: 'Tenant to Delete' };
      const mockQuery = mockClient.query as jest.Mock;
      mockQuery
        .mockResolvedValueOnce({ rows: [mockTenant], rowCount: 1 }) // For existence check
        .mockResolvedValueOnce({ rows: [mockTenant], rowCount: 1 }); // For deletion

      await program.parseAsync([
        'node', 'test', 'tenants', 'delete',
        '--id', 'tenant-1'
      ]);

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT id, name FROM tenants WHERE id = $1',
        ['tenant-1']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM tenants WHERE id = $1',
        ['tenant-1']
      );
      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should handle non-existent tenant deletion', async () => {
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(
        program.parseAsync([
          'node', 'test', 'tenants', 'delete',
          '--id', 'non-existent'
        ])
      ).rejects.toThrow('Process.exit called with code: 1');

      expect(mockClient.end).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      (mockClient.query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      await expect(
        program.parseAsync(['node', 'test', 'tenants', 'create', '--name', 'New Tenant'])
      ).rejects.toThrow('Process.exit called with code: 1');
    });
  });
}); 