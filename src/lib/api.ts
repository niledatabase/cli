import axios, { AxiosInstance } from 'axios';
import { Developer, Database, Credentials } from './types';
import { theme } from './colors';

export class NileAPI {
  private client: AxiosInstance;
  private static BASE_URL = 'https://global.dev.thenile.dev';
  private debug: boolean;

  constructor(token: string, debug: boolean = false) {
    this.debug = debug;
    this.client = axios.create({
      baseURL: NileAPI.BASE_URL,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });

    // Add request interceptor for debug logging
    this.client.interceptors.request.use(request => {
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

    // Add response interceptor for debug logging
    this.client.interceptors.response.use(response => {
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

  async getDeveloperInfo(): Promise<Developer> {
    const response = await this.client.get('/developers/me');
    return response.data;
  }

  async listDatabases(workspaceSlug: string): Promise<Database[]> {
    const response = await this.client.get(`/workspaces/${workspaceSlug}/databases`);
    return response.data;
  }

  async createDatabase(workspaceSlug: string, name: string, region: string): Promise<Database> {
    const response = await this.client.post(`/workspaces/${workspaceSlug}/databases`, {
      databaseName: name,
      region,
    });
    return response.data;
  }

  async getDatabase(workspaceSlug: string, databaseName: string): Promise<Database> {
    const response = await this.client.get(`/workspaces/${workspaceSlug}/databases/${databaseName}`);
    return response.data;
  }

  async deleteDatabase(workspaceSlug: string, databaseName: string): Promise<void> {
    await this.client.delete(`/workspaces/${workspaceSlug}/databases/${databaseName}`);
  }

  async listDatabaseCredentials(workspaceSlug: string, databaseName: string): Promise<Credentials[]> {
    const response = await this.client.get(
      `/workspaces/${workspaceSlug}/databases/${databaseName}/credentials`
    );
    return response.data;
  }

  async createDatabaseCredentials(workspaceSlug: string, databaseName: string): Promise<Credentials> {
    const response = await this.client.post(
      `/workspaces/${workspaceSlug}/databases/${databaseName}/credentials`
    );
    return response.data;
  }

  async listRegions(workspaceSlug: string): Promise<string[]> {
    const response = await this.client.get(`/workspaces/${workspaceSlug}/regions`);
    return response.data;
  }
} 