/**
 * Export Adapter - handles entity export from Backstage to files
 * Manages filtering, organization, and output formatting
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Entity } from '@backstage/catalog-model';
import { BackstageClient, FilterOptions } from '../clients/BackstageClient';

export interface ExportOptions {
  url?: string;
  token?: string;
  output?: string;
  format?: 'yaml' | 'json';
  kind?: string[];
  namespace?: string;
  name?: string;
  owner?: string;
  tags?: string[];
  organize?: boolean;
  manifest?: boolean;
  preview?: boolean;
  list?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

interface ExportManifest {
  apiVersion: string;
  kind: string;
  metadata: {
    exportedAt: string;
    backstageUrl: string;
    toolVersion: string;
  };
  spec: {
    query: {
      filters: FilterOptions;
    };
    results: {
      total: number;
      byKind: Record<string, number>;
    };
    files: Array<{
      path: string;
      kind: string;
      name: string;
    }>;
  };
}

export class ExportAdapter {
  private client?: BackstageClient;

  /**
   * Main export execution
   */
  async execute(options: ExportOptions): Promise<void> {
    try {
      // Initialize client
      this.client = this.createClient(options);

      // Test connection
      if (!options.quiet) {
        console.log(`Connecting to ${options.url || 'http://localhost:7007'}...`);
      }

      const connected = await this.client.testConnection();
      if (!connected) {
        this.error('Cannot connect to Backstage. Check URL and authentication.');
        process.exit(3);
      }

      // Build filters
      const filters: FilterOptions = {
        kind: options.kind,
        namespace: options.namespace,
        name: options.name,
        owner: options.owner,
        tags: options.tags,
      };

      // Handle different modes
      if (options.list) {
        await this.handleList(filters, options);
      } else if (options.preview) {
        await this.handlePreview(filters, options);
      } else {
        await this.handleExport(filters, options);
      }
    } catch (error) {
      this.error(`Export failed: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Create Backstage client
   */
  private createClient(options: ExportOptions): BackstageClient {
    const url = options.url || process.env.BACKSTAGE_URL || 'http://localhost:7007';
    const token = options.token || process.env.BACKSTAGE_TOKEN;

    if (!token && options.verbose) {
      console.warn('Warning: No authentication token provided');
    }

    return new BackstageClient({ url, token });
  }

  /**
   * Handle list mode
   */
  private async handleList(
    filters: FilterOptions,
    options: ExportOptions
  ): Promise<void> {
    const entities = await this.client!.queryEntities(filters);

    if (entities.length === 0) {
      console.log('No entities found');
      return;
    }

    // Group by kind for display
    const grouped = new Map<string, string[]>();
    for (const entity of entities) {
      if (!grouped.has(entity.kind)) {
        grouped.set(entity.kind, []);
      }
      grouped.get(entity.kind)!.push(entity.metadata.name);
    }

    // Display table
    console.log('\n📋 Entities in catalog:');
    console.log('─────────────────────');
    for (const [kind, names] of grouped) {
      console.log(`\n${kind} (${names.length}):`);
      for (const name of names.sort()) {
        console.log(`  - ${name}`);
      }
    }

    console.log(`\nTotal: ${entities.length} entities`);
  }

  /**
   * Handle preview mode
   */
  private async handlePreview(
    filters: FilterOptions,
    options: ExportOptions
  ): Promise<void> {
    const entities = await this.client!.queryEntities(filters);

    if (entities.length === 0) {
      console.log('No entities would be exported');
      return;
    }

    // Count by kind
    const counts = new Map<string, number>();
    for (const entity of entities) {
      counts.set(entity.kind, (counts.get(entity.kind) || 0) + 1);
    }

    console.log('\n📊 Export preview:');
    console.log('─────────────────');
    console.log(`Total entities: ${entities.length}`);
    console.log('\nBy kind:');
    for (const [kind, count] of counts) {
      console.log(`  - ${kind}: ${count}`);
    }

    if (options.organize) {
      console.log('\n📁 Directory structure:');
      console.log(options.output || './exported');
      for (const kind of counts.keys()) {
        console.log(`├── ${kind.toLowerCase()}s/`);
        console.log(`│   └── *.${options.format || 'yaml'}`);
      }
      if (options.manifest) {
        console.log('├── manifest.yaml');
      }
      console.log('└── export-metadata.json');
    }
  }

  /**
   * Handle normal export mode
   */
  private async handleExport(
    filters: FilterOptions,
    options: ExportOptions
  ): Promise<void> {
    const entities = await this.client!.queryEntities(filters);

    if (entities.length === 0) {
      console.error('No entities found matching filters');
      process.exit(4);
    }

    if (!options.quiet) {
      console.log(`Found ${entities.length} entities to export`);
    }

    // Create output directory
    const outputDir = options.output || './exported';
    await fs.mkdir(outputDir, { recursive: true });

    // Track exported files for manifest
    const exportedFiles: Array<{ path: string; kind: string; name: string }> = [];

    // Export entities
    if (options.organize) {
      // Organize by kind
      const grouped = new Map<string, Entity[]>();
      for (const entity of entities) {
        const kind = entity.kind.toLowerCase();
        if (!grouped.has(kind)) {
          grouped.set(kind, []);
        }
        grouped.get(kind)!.push(entity);
      }

      for (const [kind, kindEntities] of grouped) {
        const kindDir = path.join(outputDir, `${kind}s`);
        await fs.mkdir(kindDir, { recursive: true });

        for (const entity of kindEntities) {
          const filename = `${entity.metadata.name}.${options.format || 'yaml'}`;
          const filepath = path.join(kindDir, filename);
          await this.writeEntity(entity, filepath, options.format || 'yaml');

          exportedFiles.push({
            path: path.relative(outputDir, filepath),
            kind: entity.kind,
            name: entity.metadata.name,
          });
        }
      }
    } else {
      // Write all to single directory
      for (const entity of entities) {
        const filename = `${entity.kind.toLowerCase()}-${entity.metadata.name}.${
          options.format || 'yaml'
        }`;
        const filepath = path.join(outputDir, filename);
        await this.writeEntity(entity, filepath, options.format || 'yaml');

        exportedFiles.push({
          path: filename,
          kind: entity.kind,
          name: entity.metadata.name,
        });
      }
    }

    // Write manifest if requested
    if (options.manifest) {
      await this.writeManifest(
        outputDir,
        filters,
        entities,
        exportedFiles,
        options
      );
    }

    // Write metadata
    await this.writeMetadata(outputDir, filters, entities, options);

    if (!options.quiet) {
      console.log(`\n✅ Exported ${entities.length} entities to ${outputDir}`);
    }
  }

  /**
   * Write a single entity to file
   */
  private async writeEntity(
    entity: Entity,
    filepath: string,
    format: 'yaml' | 'json'
  ): Promise<void> {
    let content: string;
    if (format === 'json') {
      content = JSON.stringify(entity, null, 2);
    } else {
      content = yaml.dump(entity);
    }
    await fs.writeFile(filepath, content);
  }

  /**
   * Write export manifest
   */
  private async writeManifest(
    outputDir: string,
    filters: FilterOptions,
    entities: Entity[],
    files: Array<{ path: string; kind: string; name: string }>,
    options: ExportOptions
  ): Promise<void> {
    // Count by kind
    const byKind: Record<string, number> = {};
    for (const entity of entities) {
      byKind[entity.kind] = (byKind[entity.kind] || 0) + 1;
    }

    const manifest: ExportManifest = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'ExportManifest',
      metadata: {
        exportedAt: new Date().toISOString(),
        backstageUrl: options.url || 'http://localhost:7007',
        toolVersion: '1.0.0',
      },
      spec: {
        query: { filters },
        results: {
          total: entities.length,
          byKind,
        },
        files,
      },
    };

    const manifestPath = path.join(outputDir, 'manifest.yaml');
    await fs.writeFile(manifestPath, yaml.dump(manifest));
  }

  /**
   * Write export metadata
   */
  private async writeMetadata(
    outputDir: string,
    filters: FilterOptions,
    entities: Entity[],
    options: ExportOptions
  ): Promise<void> {
    // Count by kind
    const byKind: Record<string, number> = {};
    for (const entity of entities) {
      byKind[entity.kind] = (byKind[entity.kind] || 0) + 1;
    }

    const metadata = {
      export: {
        timestamp: new Date().toISOString(),
        tool: 'backstage-export',
        version: '1.0.0',
        backstageUrl: options.url || 'http://localhost:7007',
      },
      query: { filters },
      results: {
        total: entities.length,
        byKind,
      },
    };

    const metadataPath = path.join(outputDir, 'export-metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Print error message
   */
  private error(message: string): void {
    console.error(`❌ Error: ${message}`);
  }
}