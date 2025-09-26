#!/usr/bin/env node

/**
 * Ingestor CLI - Command-line tool for ingesting Kubernetes resources
 * into Backstage catalog entities
 */

import { program } from 'commander';
import { CLIAdapter, CLIOptions } from './adapters/CLIAdapter';
import { createIngestionEngine } from '../core/engine/IngestionEngine';
import { createResourceValidator } from '../core/validators/ResourceValidator';
import { createXRDEntityBuilder } from '../core/builders/XRDEntityBuilder';
import { version } from '../../package.json';

// Create the engine with default configuration
const validator = createResourceValidator();
const builders = [createXRDEntityBuilder()];
const engine = createIngestionEngine(validator, builders);

// Create CLI adapter
const adapter = new CLIAdapter(engine);

// Configure CLI
program
  .name('ingestor')
  .description('Ingest Kubernetes resources into Backstage catalog entities')
  .version(version)
  .argument('<source>', 'Source file, directory, or "-" for stdin')
  .option('-o, --output <dir>', 'Output directory', './catalog-entities')
  .option('-f, --format <format>', 'Output format (yaml or json)', 'yaml')
  .option('--owner <owner>', 'Set entity owner')
  .option('--namespace <namespace>', 'Set entity namespace')
  .option('--tags <tags>', 'Add tags (comma-separated)')
  .option('-v, --validate', 'Validate resources without ingesting')
  .option('-p, --preview', 'Preview what would be generated')
  .option('--strict', 'Fail on validation warnings')
  .option('--quiet', 'Suppress non-error output')
  .option('--verbose', 'Show detailed information')
  .action(async (source: string, options: any) => {
    // Parse options
    const cliOptions: CLIOptions = {
      output: options.output,
      format: options.format,
      owner: options.owner,
      namespace: options.namespace,
      tags: options.tags?.split(',').map((t: string) => t.trim()),
      validate: options.validate,
      preview: options.preview,
      quiet: options.quiet,
      verbose: options.verbose,
      strict: options.strict,
    };

    // Execute
    await adapter.execute(source, cliOptions);
  });

// Parse arguments
program.parse();

// Show help if no arguments
if (process.argv.length < 3) {
  program.outputHelp();
  process.exit(1);
}