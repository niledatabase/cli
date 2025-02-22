export interface Workspace {
  id?: string;
  name: string;
  slug: string;
  created?: string;
}

export interface Database {
  id: string;
  name: string;
  region: string;
  status: string;
}

export interface Developer {
  id: string;
  email: string;
  name?: string;
  workspaces: Workspace[];
}

export interface Credentials {
  id: string;
  password: string;
  database: {
    id: string;
    name: string;
    workspace: {
      id: string;
      name: string;
      slug: string;
      stripe_customer_id?: string;
      created: string;
    };
    status: string;
    region: string;
    created: string;
  };
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
} 