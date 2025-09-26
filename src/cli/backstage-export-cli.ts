#!/usr/bin/env node

/**
 * Backstage Export CLI - Export entities from Backstage catalog
 * Provides backup, migration, and auditing capabilities
 */

import { program } from 'commander';
import { ExportAdapter, ExportOptions } from './adapters/ExportAdapter';
import { version } from '../../package.json';

// Create export adapter
const adapter = new ExportAdapter();

// Configure CLI
program
  .name('backstage-export')
  .description('Export entities from Backstage catalog')
  .version(version)
  .option('-u, --url <url>', 'Backstage URL', 'http://localhost:7007')
  .option('-t, --token <token>', 'API token (or use BACKSTAGE_TOKEN env)')
  .option('-k, --kind <kinds>', 'Entity kinds (comma-separated)')
  .option('-n, --namespace <namespace>', 'Namespace filter')
  .option('--name <pattern>', 'Name pattern (supports wildcards)')
  .option('--owner <owner>', 'Owner filter')
  .option('--tags <tags>', 'Tags filter (comma-separated)')
  .option('-o, --output <dir>', 'Output directory', './exported')
  .option('-f, --format <format>', 'Output format (yaml or json)', 'yaml')
  .option('--organize', 'Organize output by entity type')
  .option('--manifest', 'Generate export manifest file')
  .option('-p, --preview', 'Preview what would be exported')
  .option('-l, --list', 'List matching entities only')
  .option('--quiet', 'Suppress non-error output')
  .option('--verbose', 'Show detailed information')
  .action(async (options: any) => {
    // Parse options
    const exportOptions: ExportOptions = {
      url: options.url,
      token: options.token || process.env.BACKSTAGE_TOKEN,
      output: options.output,
      format: options.format,
      kind: options.kind?.split(',').map((k: string) => k.trim()),
      namespace: options.namespace,
      name: options.name,
      owner: options.owner,
      tags: options.tags?.split(',').map((t: string) => t.trim()),
      organize: options.organize,
      manifest: options.manifest,
      preview: options.preview,
      list: options.list,
      quiet: options.quiet,
      verbose: options.verbose,
    };

    // Execute
    await adapter.execute(exportOptions);
  });

// Parse arguments
program.parse();