import http from 'http';
import open from 'open';
import axios from 'axios';
import crypto from 'crypto';
import { TokenResponse } from './types';
import { GlobalOptions } from './globalOptions';
import { ConfigManager } from './config';

export class Auth {
  private static DEFAULT_CLIENT_ID = 'nilecli';

  private static generateCodeVerifier(): string {
    const buffer = crypto.randomBytes(32);
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
      .substring(0, 128);
  }

  private static async generateCodeChallenge(verifier: string): Promise<string> {
    const buffer = Buffer.from(verifier);
    const hash = crypto.createHash('sha256').update(buffer).digest();
    return hash
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private static generateState(): string {
    return crypto.randomBytes(4).toString('hex');
  }

  private static async findAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = http.createServer();
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          const port = address.port;
          server.close(() => resolve(port));
        } else {
          server.close(() => reject(new Error('Could not find available port')));
        }
      });
    });
  }

  private static getAuthUrl(configManager: ConfigManager): string {
    const authDomain = configManager.getAuthUrl() || 'console.thenile.dev';
    return `https://${authDomain}/authorize`;
  }

  private static getTokenUrl(configManager: ConfigManager): string {
    const domain = configManager.getAuthUrl() || 'console.thenile.dev';
    return `https://${domain}/oauth2/token`;
  }

  static async getAuthorizationToken(
    configManager: ConfigManager,
    clientId: string = Auth.DEFAULT_CLIENT_ID
  ): Promise<string> {
    if (configManager.getDebug()) {
      console.log('Debug - Starting auth with config:', {
        clientId: Auth.DEFAULT_CLIENT_ID,
        authUrl: configManager.getAuthUrl(),
        tokenUrl: this.getTokenUrl(configManager),
        debug: configManager.getDebug()
      });
    }

    return new Promise(async (resolve, reject) => {
      const codeVerifier = this.generateCodeVerifier();
      const state = this.generateState();
      const port = await this.findAvailablePort();

      if (configManager.getDebug()) {
        console.log('Debug - Auth parameters:', {
          clientId: Auth.DEFAULT_CLIENT_ID,
          authUrl: this.getAuthUrl(configManager),
          tokenUrl: this.getTokenUrl(configManager),
          port,
          codeVerifier: codeVerifier.substring(0, 5) + '...',
          state
        });
      }
      
      const server = http.createServer(async (req, res) => {
        if (req.url === '/favicon.ico') {
          res.writeHead(404);
          res.end();
          return;
        }

        if (configManager.getDebug()) {
          console.log('Debug - Received callback request:', req.url);
        }

        if (!req.url?.includes('/callback')) {
          return;
        }

        const url = new URL(req.url!, `http://${req.headers.host}`);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        const closeServerAndReject = (status: number, message: string, error?: Error) => {
          res.writeHead(status, { 'Content-Type': 'text/html' });
          res.end(message);
          server.close();
          if (error) {
            reject(error);
          }
        };

        if (error) {
          closeServerAndReject(400, `Authentication failed: ${errorDescription || error}`, new Error(errorDescription || error));
          return;
        }

        if (returnedState !== state) {
          if (configManager.getDebug()) {
            console.log('Debug - State mismatch:', {
              expected: state,
              received: returnedState
            });
          }
          closeServerAndReject(400, 'Authentication failed: Invalid state parameter', new Error('Invalid state parameter'));
          return;
        }

        if (!code) {
          if (configManager.getDebug()) {
            console.log('Debug - No code received in callback');
          }
          closeServerAndReject(400, 'Authentication failed: No authorization code received', new Error('No authorization code received'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('Authentication successful! You can close this window.');

        try {
          if (configManager.getDebug()) {
            console.log('Debug - Exchanging code for token...');
          }

          const tokenResponse = await axios.post<TokenResponse>(
            this.getTokenUrl(configManager),
            new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              client_id: Auth.DEFAULT_CLIENT_ID,
              code_verifier: codeVerifier,
              redirect_uri: `http://localhost:${port}/callback`,
            }).toString(),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            }
          );

          if (configManager.getDebug()) {
            console.log('Debug - Token exchange successful');
          }

          server.close();
          resolve(tokenResponse.data.access_token);
        } catch (error) {
          if (configManager.getDebug()) {
            console.log('Debug - Token exchange failed:', error);
            if (axios.isAxiosError(error) && error.response) {
              console.log('Debug - Error response:', error.response.data);
            }
          }
          server.close();
          if (axios.isAxiosError(error) && error.response) {
            reject(new Error(`Token exchange failed: ${error.response.data.error_description || error.response.data.error || error.message}`));
          } else {
            reject(error);
          }
        }
      });

      server.listen(port, async () => {
        try {
          const codeChallenge = await this.generateCodeChallenge(codeVerifier);
          const params = new URLSearchParams({
            client_id: Auth.DEFAULT_CLIENT_ID,
            state,
            response_type: 'code',
            redirect_uri: `http://localhost:${port}/callback`,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
          });

          const authUrl = `${this.getAuthUrl(configManager)}?${params.toString()}`;
          if (configManager.getDebug()) {
            console.log('Debug - Full auth URL:', authUrl);
          }
          console.log('Opening authorization URL:', authUrl);
          await open(authUrl);
        } catch (error) {
          server.close();
          reject(error);
        }
      });

      setTimeout(() => {
        server.close();
        reject(new Error('Authentication timed out after 2 minutes'));
      }, 120000);
    });
  }
} 