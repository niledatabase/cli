import axios, { AxiosInstance } from 'axios';
import { Developer, Database, Credentials } from './types';

export class NileAPI {
  private client: AxiosInstance;
  private static BASE_URL = 'https://global.thenile.dev';

  constructor(token: string) {
    this.client = axios.create({
      baseURL: NileAPI.BASE_URL,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async getDeveloperInfo(): Promise<Developer> {
    const response = await this.client.get('/developers/me/full');
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

  async createDatabaseCredentials(workspaceSlug: string, databaseName: string): Promise<Credentials> {
    const response = await this.client.post(
      `/workspaces/${workspaceSlug}/databases/${databaseName}/credentials`
    );
    return response.data;
  }
} 