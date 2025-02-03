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
  token: string | undefined;
  debug?: boolean;
  controlPlaneUrl?: string;
  dbHost?: string;
}

export interface PostgresConnection {
  host: string;
  database: string;
  user: string;
  password: string;
  port?: number;
}

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  created?: string;
}

export class NileAPI {
  private controlPlaneClient: AxiosInstance;
  private static DEFAULT_CONTROL_PLANE_URL = 'https://global.thenile.dev';
  private debug: boolean;
  private token: string;
  private controlPlaneUrl: string;
  private dbHost?: string;

  constructor(options: NileAPIOptions) {
    this.debug = options.debug || false;
    if (!options.token) {
      throw new Error('Token is required');
    }
    this.token = options.token;
    
    // Handle URL override
    if (options.controlPlaneUrl) {
      // Remove any protocol prefix if present
      this.controlPlaneUrl = options.controlPlaneUrl.replace(/^(https?:\/\/)/, '');
      // Add https:// prefix
      this.controlPlaneUrl = `https://${this.controlPlaneUrl}`;
    } else {
      this.controlPlaneUrl = NileAPI.DEFAULT_CONTROL_PLANE_URL;
    }

    if (this.debug) {
      console.log(theme.dim('\nAPI Configuration:'));
      console.log(theme.dim('Control Plane URL:'), this.controlPlaneUrl);
      console.log();
    }

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

    this.dbHost = options.dbHost;
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

  async getDatabaseConnection(workspaceSlug: string, databaseName: string): Promise<PostgresConnection> {
    // Get database credentials from control plane
    console.log(theme.dim('\nFetching database credentials...'));
    const credentials = await this.createDatabaseCredentials(workspaceSlug, databaseName);

    if (!credentials.id || !credentials.password) {
      throw new Error('Invalid credentials received from server');
    }

    // Get the region from the database info
    const region = credentials.database.region;  // e.g., AWS_US_WEST_2
    const regionParts = region.toLowerCase().split('_');
    const regionPrefix = regionParts.slice(1).join('-');  // e.g., us-west-2
    
    // Use custom host if provided, otherwise use default
    const dbHost = this.dbHost ? 
      `${regionPrefix}.${this.dbHost}` : 
      `${regionPrefix}.db.thenile.dev`;

    if (this.debug) {
      console.log(theme.dim('\nPostgreSQL Connection Details:'));
      console.log(theme.dim('Host:'), dbHost);
      console.log(theme.dim('Database:'), databaseName);
      console.log(theme.dim('User:'), credentials.id);
      console.log();
    }

    return {
      host: dbHost,
      database: databaseName,
      user: credentials.id,
      password: credentials.password,
      port: 5432
    };
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

  async listWorkspaces(): Promise<Workspace[]> {
    const response = await this.controlPlaneClient.get('/workspaces');
    return response.data;
  }

  async getWorkspace(workspaceSlug: string): Promise<Workspace> {
    const response = await this.controlPlaneClient.get(`/workspaces/${workspaceSlug}`);
    return response.data;
  }
} 