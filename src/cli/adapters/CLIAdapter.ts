/**
 * CLI Adapter - bridges command-line environment with core engine
 * Handles file I/O, argument parsing, and console output
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Entity } from '@backstage/catalog-model';
import {
  IIngestionEngine,
  Resource,
  IngestionConfig,
  IngestionPreview,
  ValidationResult,
} from '../../core/engine/interfaces';

export interface CLIOptions {
  output?: string;
  format?: 'yaml' | 'json';
  owner?: string;
  namespace?: string;
  tags?: string[];
  validate?: boolean;
  preview?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  strict?: boolean;
}

export class CLIAdapter {
  constructor(private readonly engine: IIngestionEngine) {}

  /**
   * Main CLI entry point
   */
  async execute(source: string, options: CLIOptions): Promise<void> {
    try {
      // Discover resources from source
      const resources = await this.discoverResources(source);

      if (resources.length === 0) {
        this.error('No resources found in source');
        process.exit(1);
      }

      if (!options.quiet) {
        console.log(`Found ${resources.length} resource(s)`);
      }

      // Handle different modes
      if (options.validate) {
        await this.handleValidate(resources, options);
      } else if (options.preview) {
        await this.handlePreview(resources, options);
      } else {
        await this.handleIngest(resources, options);
      }
    } catch (error) {
      this.error(`Failed to execute: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Discover resources from file, directory, or stdin
   */
  private async discoverResources(source: string): Promise<Resource[]> {
    const resources: Resource[] = [];

    // Handle stdin
    if (source === '-') {
      const content = await this.readStdin();
      const docs = this.parseYAML(content);
      resources.push(...docs);
      return resources;
    }

    // Check if source exists
    const stats = await fs.stat(source).catch(() => null);
    if (!stats) {
      throw new Error(`Source not found: ${source}`);
    }

    // Handle directory
    if (stats.isDirectory()) {
      const files = await this.findYAMLFiles(source);
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const docs = this.parseYAML(content, file);
        resources.push(...docs);
      }
    } else {
      // Handle single file
      const content = await fs.readFile(source, 'utf-8');
      const docs = this.parseYAML(content, source);
      resources.push(...docs);
    }

    return resources;
  }

  /**
   * Parse YAML content into resources
   */
  private parseYAML(content: string, filename?: string): Resource[] {
    const resources: Resource[] = [];

    try {
      // Support multi-document YAML
      const docs = yaml.loadAll(content) as any[];

      for (const doc of docs) {
        if (doc && doc.apiVersion && doc.kind) {
          resources.push(doc as Resource);
        }
      }
    } catch (error) {
      const context = filename ? ` in ${filename}` : '';
      throw new Error(`Invalid YAML${context}: ${error}`);
    }

    return resources;
  }

  /**
   * Find all YAML files in directory recursively
   */
  private async findYAMLFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories
        if (!entry.name.startsWith('.')) {
          const subFiles = await this.findYAMLFiles(fullPath);
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Handle validation mode
   */
  private async handleValidate(
    resources: Resource[],
    options: CLIOptions
  ): Promise<void> {
    const results = await this.engine.validate(resources);
    let hasErrors = false;

    for (const [resource, result] of results) {
      const name = `${resource.kind}/${resource.metadata.name}`;

      if (result.errors.length > 0) {
        hasErrors = true;
        console.error(`\n❌ ${name}`);
        for (const error of result.errors) {
          console.error(`  - ${error.field}: ${error.message}`);
        }
      } else if (!options.quiet) {
        console.log(`✅ ${name}`);
      }

      if (options.verbose && result.warnings.length > 0) {
        console.warn(`⚠️  Warnings for ${name}:`);
        for (const warning of result.warnings) {
          console.warn(`  - ${warning.field}: ${warning.message}`);
        }
      }
    }

    if (hasErrors) {
      process.exit(1);
    }
  }

  /**
   * Handle preview mode
   */
  private async handlePreview(
    resources: Resource[],
    options: CLIOptions
  ): Promise<void> {
    const preview = await this.engine.preview(resources);

    console.log('\n📋 Preview Summary');
    console.log('─────────────────');
    console.log(`Total resources: ${preview.totalResources}`);
    console.log(`Valid resources: ${preview.validResources}`);
    console.log(`Invalid resources: ${preview.invalidResources}`);

    if (preview.entityCounts.size > 0) {
      console.log('\n📊 Entities to be created:');
      for (const [kind, count] of preview.entityCounts) {
        console.log(`  - ${kind}: ${count}`);
      }
    }

    if (options.verbose && preview.samples.length > 0) {
      console.log('\n📄 Sample entities:');
      for (const sample of preview.samples) {
        console.log(`\n${sample.kind}: ${sample.metadata.name}`);
        if (options.format === 'json') {
          console.log(JSON.stringify(sample, null, 2));
        } else {
          console.log(yaml.dump(sample));
        }
      }
    }

    if (preview.errors.length > 0) {
      console.error('\n❌ Validation errors:');
      for (const error of preview.errors) {
        console.error(`\n${error.resource}:`);
        for (const err of error.errors) {
          console.error(`  - ${err.field}: ${err.message}`);
        }
      }
    }
  }

  /**
   * Handle normal ingestion mode
   */
  private async handleIngest(
    resources: Resource[],
    options: CLIOptions
  ): Promise<void> {
    // Build configuration
    const config: IngestionConfig = {
      validation: {
        strict: options.strict ?? false,
      },
      building: {
        owner: options.owner,
        namespace: options.namespace,
        tags: options.tags,
      },
    };

    // Perform ingestion
    const entities = await this.engine.ingest(resources, config);

    if (!options.quiet) {
      console.log(`\n✨ Created ${entities.length} entities`);
    }

    // Write output
    await this.writeOutput(entities, options);

    if (!options.quiet) {
      const outputDir = options.output || './catalog-entities';
      console.log(`\n📁 Output written to: ${outputDir}`);
    }
  }

  /**
   * Write entities to output directory
   */
  private async writeOutput(
    entities: Entity[],
    options: CLIOptions
  ): Promise<void> {
    const outputDir = options.output || './catalog-entities';

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Group entities by kind
    const grouped = new Map<string, Entity[]>();
    for (const entity of entities) {
      const kind = entity.kind.toLowerCase();
      if (!grouped.has(kind)) {
        grouped.set(kind, []);
      }
      grouped.get(kind)!.push(entity);
    }

    // Write files
    for (const [kind, kindEntities] of grouped) {
      const subDir = path.join(outputDir, `${kind}s`);
      await fs.mkdir(subDir, { recursive: true });

      for (const entity of kindEntities) {
        const filename = `${entity.metadata.name}.${options.format || 'yaml'}`;
        const filepath = path.join(subDir, filename);

        let content: string;
        if (options.format === 'json') {
          content = JSON.stringify(entity, null, 2);
        } else {
          content = yaml.dump(entity);
        }

        await fs.writeFile(filepath, content);
      }
    }

    // Write catalog-info.yaml with all entities
    const catalogPath = path.join(outputDir, 'catalog-info.yaml');
    const catalogContent = entities.map(e => yaml.dump(e)).join('---\n');
    await fs.writeFile(catalogPath, `---\n${catalogContent}`);
  }

  /**
   * Read from stdin
   */
  private async readStdin(): Promise<string> {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      process.stdin.on('data', chunk => chunks.push(chunk));
      process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString()));
      process.stdin.on('error', reject);
    });
  }

  /**
   * Print error message
   */
  private error(message: string): void {
    console.error(`❌ Error: ${message}`);
  }
}