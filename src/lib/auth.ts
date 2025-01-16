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

  static async getAuthorizationToken(clientId: string = Auth.DEFAULT_CLIENT_ID): Promise<string> {
    return new Promise((resolve, reject) => {
      const codeVerifier = this.generateCodeVerifier();
      
      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`Authentication failed: ${errorDescription || error}`);
          server.close();
          reject(new Error(errorDescription || error));
          return;
        }

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
              }).toString(),
              {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
                }
              }
            );

            resolve(tokenResponse.data.access_token);
          } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
              reject(new Error(`Token exchange failed: ${error.response.data.error || error.message}`));
            } else {
              reject(error);
            }
          }
        }
      });

      server.listen(8080, async () => {
        try {
          const codeChallenge = await this.generateCodeChallenge(codeVerifier);
          const params = new URLSearchParams({
            client_id: clientId,
            response_type: 'code',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            redirect_uri: 'http://localhost:8080/callback',
            scope: 'databases workspaces query'
          });

          const authUrl = `${Auth.AUTH_URL}?${params.toString()}`;
          console.log('Opening authorization URL:', authUrl);
          await open(authUrl);
        } catch (error) {
          server.close();
          reject(error);
        }
      });

      setTimeout(() => {
        server.close();
        reject(new Error('Authentication timed out after 5 minutes'));
      }, 300000);
    });
  }
} 