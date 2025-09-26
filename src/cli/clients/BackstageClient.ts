/**
 * Backstage Client - communicates with Backstage REST API
 * Handles authentication, pagination, and error recovery
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { Entity } from '@backstage/catalog-model';

export interface FilterOptions {
  kind?: string[];
  namespace?: string;
  name?: string;
  owner?: string;
  tags?: string[];
}

export interface BackstageClientConfig {
  url: string;
  token?: string;
  timeout?: number;
}

export class BackstageClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly timeout: number;

  constructor(config: BackstageClientConfig) {
    this.baseUrl = config.url.replace(/\/$/, ''); // Remove trailing slash
    this.token = config.token;
    this.timeout = config.timeout || 30000;
  }

  /**
   * Query entities from the catalog
   */
  async queryEntities(filters?: FilterOptions): Promise<Entity[]> {
    const entities: Entity[] = [];
    let nextUrl: string | null = this.buildQueryUrl(filters);

    while (nextUrl) {
      const response = await this.fetchPage(nextUrl);
      entities.push(...response.items);

      // Handle pagination
      nextUrl = response.pageInfo?.nextLink
        ? `${this.baseUrl}${response.pageInfo.nextLink}`
        : null;

      // Add small delay between requests
      if (nextUrl) {
        await this.delay(100);
      }
    }

    return entities;
  }

  /**
   * Build query URL with filters
   */
  private buildQueryUrl(filters?: FilterOptions): string {
    const url = new URL(`${this.baseUrl}/api/catalog/entities`);

    if (filters) {
      // Add kind filters
      if (filters.kind && filters.kind.length > 0) {
        for (const kind of filters.kind) {
          url.searchParams.append('filter', `kind=${kind}`);
        }
      }

      // Add namespace filter
      if (filters.namespace) {
        url.searchParams.append('filter', `metadata.namespace=${filters.namespace}`);
      }

      // Add name pattern filter
      if (filters.name) {
        url.searchParams.append('filter', `metadata.name~${filters.name}`);
      }

      // Add owner filter
      if (filters.owner) {
        url.searchParams.append('filter', `spec.owner=${filters.owner}`);
      }

      // Add tag filters
      if (filters.tags && filters.tags.length > 0) {
        for (const tag of filters.tags) {
          url.searchParams.append('filter', `metadata.tags=${tag}`);
        }
      }
    }

    return url.toString();
  }

  /**
   * Fetch a single page of results
   */
  private async fetchPage(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        },
        timeout: this.timeout,
      };

      const req = protocol.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              resolve(json);
            } catch (error) {
              reject(new Error(`Invalid JSON response: ${error}`));
            }
          } else if (res.statusCode === 401) {
            reject(new Error('Authentication failed: Invalid or expired token'));
          } else if (res.statusCode === 404) {
            reject(new Error(`API endpoint not found: ${url}`));
          } else if (res.statusCode === 429) {
            // Rate limited - should retry with backoff
            reject(new Error('Rate limited: Too many requests'));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Connection error: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Test connection to Backstage
   */
  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/api/catalog/entities?limit=1`;
      await this.fetchPage(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}