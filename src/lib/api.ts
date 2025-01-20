import axios, { AxiosInstance } from 'axios';
import { Developer, Database, Credentials } from './types';
import { theme } from './colors';

export interface Tenant {
  id: string;
  name?: string;
}

export interface CreateTenantRequest {
  name: string;
  id?: string;
}

export interface NileAPIOptions {
  token: string;
  debug?: boolean;
  controlPlaneUrl?: string;
  dataPlaneUrl?: string;
}

export class NileAPI {
  private controlPlaneClient: AxiosInstance;
  private dataPlaneClient: AxiosInstance | null = null;
  private static DEFAULT_CONTROL_PLANE_URL = 'https://global.thenile.dev';
  private static DEFAULT_DATA_PLANE_URL = 'https://api.thenile.dev';
  private debug: boolean;
  private token: string;
  private controlPlaneUrl: string;
  private dataPlaneUrl: string;

  constructor(options: NileAPIOptions) {
    this.debug = options.debug || false;
    this.token = options.token;
    this.controlPlaneUrl = options.controlPlaneUrl || NileAPI.DEFAULT_CONTROL_PLANE_URL;
    this.dataPlaneUrl = options.dataPlaneUrl || NileAPI.DEFAULT_DATA_PLANE_URL;

    // Create control plane client for workspace/database operations
    this.controlPlaneClient = axios.create({
      baseURL: this.controlPlaneUrl,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
    });

    // Add debug logging
    this.addDebugLogging(this.controlPlaneClient);
  }

  private addDebugLogging(client: AxiosInstance) {
    client.interceptors.request.use(request => {
      if (this.debug) {
        console.log(theme.dim('\nAPI Request:'));
        console.log(theme.dim(`${request.method?.toUpperCase()} ${request.baseURL}${request.url}`));
        console.log(theme.dim('Headers:'), {
          ...request.headers,
          Authorization: request.headers.Authorization ? 'Bearer [hidden]' : undefined
        });
        if (request.data) {
          console.log(theme.dim('Body:'), request.data);
        }
        console.log();
      }
      return request;
    });

    client.interceptors.response.use(response => {
      if (this.debug) {
        console.log(theme.dim('API Response Status:'), response.status);
        if (response.data) {
          console.log(theme.dim('Response Data:'), response.data);
        }
      }
      return response;
    }, error => {
      if (this.debug && error.response) {
        console.log(theme.dim('API Error Response:'), {
          status: error.response.status,
          data: error.response.data
        });
      }
      throw error;
    });
  }

  private async ensureDataPlaneClient(workspaceSlug: string, databaseName: string): Promise<AxiosInstance> {
    if (!this.dataPlaneClient) {
      // Get database credentials from control plane
      console.log(theme.dim('\nFetching database credentials...'));
      const credentials = await this.createDatabaseCredentials(workspaceSlug, databaseName);

      if (!credentials.id || !credentials.password) {
        throw new Error('Invalid credentials received from server');
      }

      // Create Bearer token from credentials
      const bearerToken = `${credentials.id}:${credentials.password}`;

      if (this.debug) {
        console.log(theme.dim('\nConstructing Bearer Token:'));
        console.log(theme.dim('Bearer Token:'), bearerToken);
        console.log();
      }

      // Create data plane client with Bearer token
      this.dataPlaneClient = axios.create({
        baseURL: this.dataPlaneUrl,
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json'
        },
      });

      // Add debug logging showing actual Bearer token
      this.dataPlaneClient.interceptors.request.use(request => {
        if (this.debug) {
          console.log(theme.dim('\nAPI Request:'));
          console.log(theme.dim(`${request.method?.toUpperCase()} ${request.baseURL}${request.url}`));
          console.log(theme.dim('Headers:'), {
            ...request.headers,
            Authorization: request.headers.Authorization
          });
          if (request.data) {
            console.log(theme.dim('Body:'), request.data);
          }
          console.log();
        }
        return request;
      });

      this.dataPlaneClient.interceptors.response.use(response => {
        if (this.debug) {
          console.log(theme.dim('API Response Status:'), response.status);
          if (response.data) {
            console.log(theme.dim('Response Data:'), response.data);
          }
        }
        return response;
      }, error => {
        if (this.debug && error.response) {
          console.log(theme.dim('API Error Response:'), {
            status: error.response.status,
            data: error.response.data
          });
        }
        throw error;
      });
    }

    return this.dataPlaneClient;
  }

  async getDeveloperInfo(): Promise<Developer> {
    const response = await this.controlPlaneClient.get('/developers/me');
    return response.data;
  }

  async listDatabases(workspaceSlug: string): Promise<Database[]> {
    const response = await this.controlPlaneClient.get(`/workspaces/${workspaceSlug}/databases`);
    return response.data;
  }

  async createDatabase(workspaceSlug: string, name: string, region: string): Promise<Database> {
    const response = await this.controlPlaneClient.post(`/workspaces/${workspaceSlug}/databases`, {
      databaseName: name,
      region,
    });
    return response.data;
  }

  async getDatabase(workspaceSlug: string, databaseName: string): Promise<Database> {
    const response = await this.controlPlaneClient.get(`/workspaces/${workspaceSlug}/databases/${databaseName}`);
    return response.data;
  }

  async deleteDatabase(workspaceSlug: string, databaseName: string): Promise<void> {
    await this.controlPlaneClient.delete(`/workspaces/${workspaceSlug}/databases/${databaseName}`);
  }

  async listDatabaseCredentials(workspaceSlug: string, databaseName: string): Promise<Credentials[]> {
    const response = await this.controlPlaneClient.get(
      `/workspaces/${workspaceSlug}/databases/${databaseName}/credentials`
    );
    return response.data;
  }

  async createDatabaseCredentials(workspaceSlug: string, databaseName: string): Promise<Credentials> {
    const response = await this.controlPlaneClient.post(
      `/workspaces/${workspaceSlug}/databases/${databaseName}/credentials`
    );
    return response.data;
  }

  async listRegions(workspaceSlug: string): Promise<string[]> {
    const response = await this.controlPlaneClient.get(`/workspaces/${workspaceSlug}/regions`);
    return response.data;
  }

  // Tenant operations using the data plane client with database credentials
  async listTenants(workspaceSlug: string, databaseName: string): Promise<Tenant[]> {
    const client = await this.ensureDataPlaneClient(workspaceSlug, databaseName);
    const response = await client.get(`/workspaces/${workspaceSlug}/databases/${databaseName}/tenants`);
    return response.data;
  }

  async createTenant(workspaceSlug: string, databaseName: string, tenant: CreateTenantRequest): Promise<Tenant> {
    const client = await this.ensureDataPlaneClient(workspaceSlug, databaseName);
    const response = await client.post(`/workspaces/${workspaceSlug}/databases/${databaseName}/tenants`, tenant);
    return response.data;
  }

  async updateTenant(workspaceSlug: string, databaseName: string, tenantId: string, tenant: { name: string }): Promise<Tenant> {
    const client = await this.ensureDataPlaneClient(workspaceSlug, databaseName);
    const response = await client.put(`/workspaces/${workspaceSlug}/databases/${databaseName}/tenants/${tenantId}`, tenant);
    return response.data;
  }

  async deleteTenant(workspaceSlug: string, databaseName: string, tenantId: string): Promise<void> {
    const client = await this.ensureDataPlaneClient(workspaceSlug, databaseName);
    await client.delete(`/workspaces/${workspaceSlug}/databases/${databaseName}/tenants/${tenantId}`);
  }
} 