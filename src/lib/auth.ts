import http from 'http';
import open from 'open';
import axios from 'axios';
import { TokenResponse } from './types';

export class Auth {
  private static AUTH_URL = 'https://console.thenile.dev/authorize';
  private static TOKEN_URL = 'https://global.thenile.dev/oauth2/token';

  static async getAuthorizationToken(
    clientId: string,
    clientSecret: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
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
                client_secret: clientSecret,
                redirect_uri: 'http://localhost:8080/callback',
              })
            );

            resolve(tokenResponse.data.access_token);
          } catch (error) {
            reject(error);
          }
        }
      });

      server.listen(8080, () => {
        const authUrl = `${Auth.AUTH_URL}?client_id=${clientId}&response_type=code&redirect_uri=http://localhost:8080/callback&scope=databases,workspaces,query`;
        open(authUrl);
      });
    });
  }
} 