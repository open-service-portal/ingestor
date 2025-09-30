#!/usr/bin/env node
/**
 * XRD Transform CLI
 * Transform XRDs into Backstage templates using Eta templates
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { transform } from '../lib/transform';
import { XRDExtractData } from '../lib/types';

const program = new Command();

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function log(message: string, color?: keyof typeof colors) {
  const colorCode = color ? colors[color] : colors.reset;
  console.error(`${colorCode}${message}${colors.reset}`);
}

program
  .name('xrd-transform')
  .description('Transform XRDs into Backstage templates using Eta templates')
  .version('1.0.0')
  .argument('[input]', 'Input file or directory (or stdin if not provided)')
  .option('-t, --templates <dir>', 'Template directory', './templates')
  .option('-o, --output <dir>', 'Output directory (default: stdout)')
  .option('-f, --format <format>', 'Output format (yaml|json)', 'yaml')
  .option('--single-file', 'Output all entities to a single file')
  .option('--organize', 'Organize output by entity type')
  .option('-v, --verbose', 'Verbose output')
  .option('--validate', 'Validate output')
  .option('--watch', 'Watch for changes (when input is directory)')
  .action(async (input, options) => {
    try {
      // Read input
      const xrdData = await readInput(input, options);

      if (!xrdData || xrdData.length === 0) {
        log('No XRD data found', 'yellow');
        process.exit(1);
      }

      // Check template directory
      if (!fs.existsSync(options.templates)) {
        log(`Template directory not found: ${options.templates}`, 'red');
        log('Creating default templates...', 'yellow');
        await createDefaultTemplates(options.templates);
      }

      // Transform
      if (options.verbose) {
        log(`Transforming ${xrdData.length} XRD(s)...`, 'blue');
      }

      const result = await transform(xrdData, {
        templateDir: options.templates,
        format: options.format,
        verbose: options.verbose,
        validate: options.validate,
      });

      if (!result.success) {
        log('Transform failed:', 'red');
        result.errors?.forEach(error => log(`  - ${error}`, 'red'));
        process.exit(1);
      }

      // Output
      await writeOutput(result.entities, options);

      if (options.verbose) {
        log(`✨ Generated ${result.entities.length} entities`, 'green');
      }

      // Watch mode
      if (options.watch && input && fs.statSync(input).isDirectory()) {
        log('Watching for changes...', 'blue');
        watchDirectory(input, options);
      }

    } catch (error) {
      log(`Error: ${error}`, 'red');
      process.exit(1);
    }
  });

/**
 * Read input from file, directory, or stdin
 */
async function readInput(input: string | undefined, options: any): Promise<XRDExtractData[]> {
  const results: XRDExtractData[] = [];

  if (!input || input === '-') {
    // Read from stdin
    const stdinData = await readStdin();
    const parsed = parseInput(stdinData);

    if (isXRDExtractData(parsed)) {
      results.push(parsed);
    } else if (Array.isArray(parsed)) {
      results.push(...parsed.filter(isXRDExtractData));
    } else {
      // Assume it's a raw XRD
      results.push({
        source: 'stdin',
        timestamp: new Date().toISOString(),
        xrd: parsed,
      });
    }
  } else if (fs.existsSync(input)) {
    const stat = fs.statSync(input);

    if (stat.isDirectory()) {
      // Read all JSON/YAML files from directory
      const files = fs.readdirSync(input)
        .filter(f => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml'));

      for (const file of files) {
        const filePath = path.join(input, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseInput(content);

        if (isXRDExtractData(parsed)) {
          results.push(parsed);
        } else {
          // Assume it's a raw XRD
          results.push({
            source: 'file',
            timestamp: new Date().toISOString(),
            xrd: parsed,
            metadata: { path: filePath },
          });
        }
      }
    } else {
      // Read single file
      const content = fs.readFileSync(input, 'utf-8');
      const parsed = parseInput(content);

      if (isXRDExtractData(parsed)) {
        results.push(parsed);
      } else if (Array.isArray(parsed)) {
        results.push(...parsed.filter(isXRDExtractData));
      } else {
        // Assume it's a raw XRD
        results.push({
          source: 'file',
          timestamp: new Date().toISOString(),
          xrd: parsed,
          metadata: { path: input },
        });
      }
    }
  } else {
    throw new Error(`Input not found: ${input}`);
  }

  return results;
}

/**
 * Parse input string as JSON or YAML
 */
function parseInput(input: string): any {
  try {
    return JSON.parse(input);
  } catch {
    try {
      return yaml.load(input);
    } catch (error) {
      throw new Error(`Failed to parse input as JSON or YAML: ${error}`);
    }
  }
}

/**
 * Check if object is XRDExtractData
 */
function isXRDExtractData(obj: any): obj is XRDExtractData {
  return obj &&
    typeof obj === 'object' &&
    'source' in obj &&
    'timestamp' in obj &&
    'xrd' in obj;
}

/**
 * Read from stdin
 */
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');

    process.stdin.on('data', chunk => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    process.stdin.on('error', reject);

    // Check if stdin is a TTY (no piped input)
    if (process.stdin.isTTY) {
      reject(new Error('No input provided. Use a file, directory, or pipe data to stdin.'));
    }
  });
}

/**
 * Write output to file or stdout
 */
async function writeOutput(entities: any[], options: any): Promise<void> {
  const format = options.format === 'json' ? 'json' : 'yaml';

  if (!options.output) {
    // Write to stdout
    for (const entity of entities) {
      const output = format === 'json'
        ? JSON.stringify(entity, null, 2)
        : yaml.dump(entity);

      console.log(output);
      if (format === 'yaml' && entities.indexOf(entity) < entities.length - 1) {
        console.log('---'); // YAML document separator
      }
    }
  } else {
    // Write to files
    if (!fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
    }

    if (options.singleFile) {
      // Write all to single file
      const filename = `entities.${format}`;
      const filepath = path.join(options.output, filename);

      const content = format === 'json'
        ? JSON.stringify(entities, null, 2)
        : entities.map(e => yaml.dump(e)).join('---\n');

      fs.writeFileSync(filepath, content);

      if (options.verbose) {
        log(`Wrote ${filepath}`, 'gray');
      }
    } else if (options.organize) {
      // Organize by entity type
      for (const entity of entities) {
        const kind = entity.kind || 'Unknown';
        const name = entity.metadata?.name || 'unnamed';
        const dir = path.join(options.output, kind);

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const filename = `${name}.${format}`;
        const filepath = path.join(dir, filename);

        const content = format === 'json'
          ? JSON.stringify(entity, null, 2)
          : yaml.dump(entity);

        fs.writeFileSync(filepath, content);

        if (options.verbose) {
          log(`Wrote ${filepath}`, 'gray');
        }
      }
    } else {
      // Write each entity to separate file
      for (const entity of entities) {
        const kind = entity.kind?.toLowerCase() || 'entity';
        const name = entity.metadata?.name || 'unnamed';
        const filename = `${name}-${kind}.${format}`;
        const filepath = path.join(options.output, filename);

        const content = format === 'json'
          ? JSON.stringify(entity, null, 2)
          : yaml.dump(entity);

        fs.writeFileSync(filepath, content);

        if (options.verbose) {
          log(`Wrote ${filepath}`, 'gray');
        }
      }
    }
  }
}

/**
 * Watch directory for changes
 */
function watchDirectory(dir: string, options: any): void {
  fs.watch(dir, async (eventType, filename) => {
    if (filename && (filename.endsWith('.json') || filename.endsWith('.yaml') || filename.endsWith('.yml'))) {
      log(`Change detected: ${filename}`, 'yellow');

      try {
        const xrdData = await readInput(dir, options);
        const result = await transform(xrdData, {
          templateDir: options.templates,
          format: options.format,
          verbose: options.verbose,
          validate: options.validate,
        });

        if (result.success) {
          await writeOutput(result.entities, options);
          log(`✨ Regenerated ${result.entities.length} entities`, 'green');
        } else {
          log('Transform failed:', 'red');
          result.errors?.forEach(error => log(`  - ${error}`, 'red'));
        }
      } catch (error) {
        log(`Error: ${error}`, 'red');
      }
    }
  });
}

/**
 * Create default templates if directory doesn't exist
 */
async function createDefaultTemplates(templateDir: string): Promise<void> {
  const dirs = ['backstage', 'wizard', 'steps', 'api'];

  for (const dir of dirs) {
    const dirPath = path.join(templateDir, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // Create default Backstage template
  const defaultBackstageTemplate = `apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: <%= data.helpers.slugify(data.xrd.metadata.name) %>
  title: <%= data.helpers.extractTitle(data.xrd) %>
  description: <%= data.xrd.metadata.annotations?.['backstage.io/description'] || 'Create ' + data.xrd.spec.names.kind + ' resources' %>
  tags:
    - crossplane
    - <%= data.xrd.spec.group %>
spec:
  owner: <%= data.xrd.metadata.annotations?.['backstage.io/owner'] || 'platform-team' %>
  type: crossplane-resource

  parameters:
    - title: Basic Information
      required:
        - name
      properties:
        name:
          title: Name
          type: string
          description: Name of the <%= data.xrd.spec.names.kind %>
          pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'

    - title: Resource Configuration
      properties:
<% data.helpers.extractProperties(data.xrd).forEach(prop => { %>
        <%= prop.name %>:
          title: <%= prop.title %>
          type: <%= prop.type %>
          <% if (prop.description) { %>description: <%= prop.description %><% } %>
          <% if (prop.default !== undefined) { %>default: <%= JSON.stringify(prop.default) %><% } %>
          <% if (prop.enum) { %>enum: <%= JSON.stringify(prop.enum) %><% } %>
<% }) %>

  steps:
    - id: create-resource
      name: Create <%= data.xrd.spec.names.kind %>
      action: kubernetes:apply
      input:
        manifest: |
          apiVersion: <%= data.xrd.spec.group %>/<%= data.xrd.spec.versions[0].name %>
          kind: <%= data.xrd.spec.names.kind %>
          metadata:
            name: \${{ parameters.name }}
          spec: \${{ parameters }}
`;

  fs.writeFileSync(
    path.join(templateDir, 'backstage', 'default.eta'),
    defaultBackstageTemplate
  );

  log('Created default templates', 'green');
}

// Parse command line arguments
program.parse(process.argv);