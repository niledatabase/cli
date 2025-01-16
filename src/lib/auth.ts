import http from 'http';
import open from 'open';
import axios from 'axios';
import crypto from 'crypto';
import { TokenResponse } from './types';

export class Auth {
  private static AUTH_URL = 'https://console.thenile.dev/authorize';
  private static TOKEN_URL = 'https://global.thenile.dev/oauth2/token';
  private static DEFAULT_CLIENT_ID = 'nilecli';

  private static generateCodeVerifier(): string {
    return crypto.randomBytes(32)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 128);
  }

  private static async generateCodeChallenge(verifier: string): Promise<string> {
    const hash = crypto.createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return hash;
  }

  static async getAuthorizationToken(clientId: string = Auth.DEFAULT_CLIENT_ID): Promise<string> {
    return new Promise((resolve, reject) => {
      const codeVerifier = this.generateCodeVerifier();
      
      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const code = url.searchParams.get('code');

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('Authentication successful! You can close this window.');
          server.close();

          try {
            const tokenResponse = await axios.post<TokenResponse>(
              Auth.TOKEN_URL,
              new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: clientId,
                code_verifier: codeVerifier,
                redirect_uri: 'http://localhost:8080/callback',
              })
            );

            resolve(tokenResponse.data.access_token);
          } catch (error) {
            reject(error);
          }
        }
      });

      server.listen(8080, async () => {
        try {
          const codeChallenge = await this.generateCodeChallenge(codeVerifier);
          const authUrl = `${Auth.AUTH_URL}?` + new URLSearchParams({
            client_id: clientId,
            response_type: 'code',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            redirect_uri: 'http://localhost:8080/callback',
            scope: 'databases workspaces query'
          });
          
          await open(authUrl);
        } catch (error) {
          server.close();
          reject(error);
        }
      });
    });
  }
} 