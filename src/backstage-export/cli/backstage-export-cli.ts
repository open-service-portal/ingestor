#!/usr/bin/env ts-node

/**
 * Backstage Export CLI
 *
 * Exports entities from a running Backstage catalog via the REST API.
 * This is a simplified implementation that replaced the old unified engine approach.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

interface ExportOptions {
  url: string;
  token?: string;
  kind?: string;
  namespace?: string;
  owner?: string;
  name?: string;
  tags?: string;
  output: string;
  organize: boolean;
  manifest: boolean;
  preview: boolean;
  list: boolean;
  format: 'yaml' | 'json';
}

interface Entity {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    [key: string]: any;
  };
  spec?: any;
  [key: string]: any;
}

/**
 * Fetch entities from Backstage catalog API
 */
async function fetchEntities(url: string, token?: string, filter?: string): Promise<Entity[]> {
  const catalogUrl = `${url}/api/catalog/entities${filter ? `?filter=${encodeURIComponent(filter)}` : ''}`;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(catalogUrl, { headers });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data as Entity[];
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch entities: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Build filter string for Backstage API
 */
function buildFilter(options: Partial<ExportOptions>): string | undefined {
  const filters: string[] = [];

  if (options.kind) {
    const kinds = options.kind.split(',').map(k => k.trim());
    filters.push(`kind=${kinds.join(',')}`);
  }

  if (options.namespace) {
    filters.push(`metadata.namespace=${options.namespace}`);
  }

  if (options.owner) {
    filters.push(`spec.owner=${options.owner}`);
  }

  if (options.name) {
    filters.push(`metadata.name=${options.name}`);
  }

  if (options.tags) {
    const tags = options.tags.split(',').map(t => t.trim());
    tags.forEach(tag => {
      filters.push(`metadata.tags=${tag}`);
    });
  }

  return filters.length > 0 ? filters.join(',') : undefined;
}

/**
 * Export entities to files
 */
async function exportEntities(entities: Entity[], options: ExportOptions): Promise<void> {
  const outputDir = options.output;

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const manifestEntries: any[] = [];

  if (options.organize) {
    // Organize by entity kind
    const byKind = entities.reduce((acc, entity) => {
      const kind = entity.kind.toLowerCase();
      if (!acc[kind]) {
        acc[kind] = [];
      }
      acc[kind].push(entity);
      return acc;
    }, {} as Record<string, Entity[]>);

    for (const [kind, kindEntities] of Object.entries(byKind)) {
      const kindDir = path.join(outputDir, kind);
      if (!fs.existsSync(kindDir)) {
        fs.mkdirSync(kindDir, { recursive: true });
      }

      for (const entity of kindEntities) {
        const filename = `${entity.metadata.name}.${options.format}`;
        const filepath = path.join(kindDir, filename);
        const content = options.format === 'yaml'
          ? yaml.stringify(entity)
          : JSON.stringify(entity, null, 2);

        fs.writeFileSync(filepath, content);
        manifestEntries.push({
          kind: entity.kind,
          name: entity.metadata.name,
          namespace: entity.metadata.namespace,
          file: path.relative(outputDir, filepath),
        });
      }
    }
  } else {
    // Single directory
    for (const entity of entities) {
      const filename = `${entity.kind.toLowerCase()}-${entity.metadata.name}.${options.format}`;
      const filepath = path.join(outputDir, filename);
      const content = options.format === 'yaml'
        ? yaml.stringify(entity)
        : JSON.stringify(entity, null, 2);

      fs.writeFileSync(filepath, content);
      manifestEntries.push({
        kind: entity.kind,
        name: entity.metadata.name,
        namespace: entity.metadata.namespace,
        file: filename,
      });
    }
  }

  // Generate manifest
  if (options.manifest) {
    const manifestPath = path.join(outputDir, 'manifest.yaml');
    const manifest = {
      exportedAt: new Date().toISOString(),
      source: options.url,
      totalEntities: entities.length,
      entities: manifestEntries,
    };
    fs.writeFileSync(manifestPath, yaml.stringify(manifest));
    console.log(`\n✓ Manifest written to ${manifestPath}`);
  }
}

/**
 * Main CLI program
 */
async function main() {
  const program = new Command();

  program
    .name('backstage-export')
    .description('Export entities from Backstage catalog')
    .version('1.0.0')
    .option('-u, --url <url>', 'Backstage URL', 'http://localhost:7007')
    .option('-t, --token <token>', 'API token for authentication', process.env.BACKSTAGE_TOKEN)
    .option('-k, --kind <kinds>', 'Entity kinds (comma-separated)', '')
    .option('--namespace <namespace>', 'Namespace filter')
    .option('--owner <owner>', 'Owner filter')
    .option('--name <pattern>', 'Name pattern filter')
    .option('--tags <tags>', 'Tags filter (comma-separated)')
    .option('-o, --output <dir>', 'Output directory', 'exported')
    .option('--organize', 'Organize output by entity type', false)
    .option('--manifest', 'Generate export manifest', false)
    .option('-p, --preview', 'Preview what would be exported', false)
    .option('-l, --list', 'List matching entities only', false)
    .option('-f, --format <format>', 'Output format (yaml|json)', 'yaml')
    .parse(process.argv);

  const options = program.opts() as ExportOptions;

  // Validate format
  if (options.format !== 'yaml' && options.format !== 'json') {
    console.error('Error: Format must be either "yaml" or "json"');
    process.exit(1);
  }

  try {
    console.log(`Connecting to Backstage at ${options.url}...`);

    const filter = buildFilter(options);
    if (filter) {
      console.log(`Applying filters: ${filter}`);
    }

    const entities = await fetchEntities(options.url, options.token, filter);

    console.log(`\n✓ Found ${entities.length} entities`);

    if (options.list || options.preview) {
      // Just list entities
      console.log('\nEntities:');
      entities.forEach(entity => {
        const namespace = entity.metadata.namespace || 'default';
        console.log(`  - ${entity.kind}:${namespace}/${entity.metadata.name}`);
      });

      if (options.preview) {
        console.log(`\nWould export to: ${options.output}`);
        console.log(`Organization: ${options.organize ? 'by kind' : 'flat'}`);
        console.log(`Format: ${options.format}`);
      }
    } else {
      // Export entities
      await exportEntities(entities, options);
      console.log(`\n✓ Exported ${entities.length} entities to ${options.output}`);
    }

  } catch (error) {
    if (error instanceof Error) {
      console.error(`\nError: ${error.message}`);
    } else {
      console.error(`\nUnexpected error:`, error);
    }
    process.exit(1);
  }
}

// Run CLI
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, fetchEntities, buildFilter, exportEntities };
