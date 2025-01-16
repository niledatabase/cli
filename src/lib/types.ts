export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export interface Database {
  name: string;
  region: string;
  status: string;
}

export interface Developer {
  id: string;
  email: string;
  workspaces: Workspace[];
}

export interface Credentials {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
} 