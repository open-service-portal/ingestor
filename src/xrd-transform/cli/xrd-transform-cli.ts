#!/usr/bin/env node
/**
 * XRD Transform CLI
 * Transform XRDs into Backstage templates using Eta templates
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';
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

/**
 * Get current kubectl context
 */
function getCurrentKubectlContext(): string | undefined {
  try {
    const context = execSync('kubectl config current-context', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'] // Suppress stderr
    }).trim();
    return context;
  } catch {
    // kubectl not available or no context set
    return undefined;
  }
}

/**
 * Load configuration from app-config files
 *
 * Priority:
 * 1. app-config/ingestor.yaml (modular config)
 * 2. app-config.yaml + includes (monolithic config)
 *
 * If app-config/ingestor.yaml exists, don't load app-config.yaml
 */
function loadIngestorConfig(configPath?: string): any {
  // If explicit config path provided, use it
  if (configPath) {
    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        return yaml.load(configContent);
      } catch (error) {
        log(`Warning: Failed to load config from ${configPath}: ${error}`, 'yellow');
      }
    } else {
      log(`Warning: Config file not found: ${configPath}`, 'yellow');
    }
  }

  // Possible base directories to search
  const baseDirs = [
    process.cwd(),                                    // Current working directory (app-portal root)
    path.join(process.cwd(), '../..'),                // From plugin directory
    path.join(__dirname, '../../..'),                 // From dist/xrd-transform/cli
    path.join(__dirname, '../../../..'),              // From src/xrd-transform/cli
  ];

  // Try modular config first (app-config/ingestor.yaml)
  for (const baseDir of baseDirs) {
    const modularConfigPath = path.join(baseDir, 'app-config', 'ingestor.yaml');
    if (fs.existsSync(modularConfigPath)) {
      try {
        const configContent = fs.readFileSync(modularConfigPath, 'utf-8');
        const config = yaml.load(configContent);
        return config;
      } catch (error) {
        log(`Warning: Found config at ${modularConfigPath} but failed to load: ${error}`, 'yellow');
      }
    }
  }

  // Fall back to monolithic config (app-config.yaml + includes)
  for (const baseDir of baseDirs) {
    const monolithicConfigPath = path.join(baseDir, 'app-config.yaml');
    if (fs.existsSync(monolithicConfigPath)) {
      try {
        const config = loadAppConfig(monolithicConfigPath, baseDir);
        return config;
      } catch (error) {
        log(`Warning: Found config at ${monolithicConfigPath} but failed to load: ${error}`, 'yellow');
      }
    }
  }

  // Return empty config if not found
  return {};
}

/**
 * Load app-config.yaml and process $include directives
 */
function loadAppConfig(configPath: string, baseDir: string): any {
  const configContent = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.load(configContent) as any;

  // Process $include directives if present
  if (config && typeof config === 'object') {
    return processIncludes(config, baseDir);
  }

  return config;
}

/**
 * Process $include directives in config object
 * Backstage uses $include to reference other config files
 */
function processIncludes(obj: any, baseDir: string): any {
  if (Array.isArray(obj)) {
    return obj.map(item => processIncludes(item, baseDir));
  }

  if (obj && typeof obj === 'object') {
    // Handle $include directive
    if (obj.$include) {
      const includePath = path.resolve(baseDir, obj.$include);
      if (fs.existsSync(includePath)) {
        try {
          const includeContent = fs.readFileSync(includePath, 'utf-8');
          const includeData = yaml.load(includeContent);
          // Recursively process includes in the included file
          return processIncludes(includeData, path.dirname(includePath));
        } catch (error) {
          log(`Warning: Failed to load include ${includePath}: ${error}`, 'yellow');
          return obj;
        }
      }
      return obj;
    }

    // Recursively process all object properties
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = processIncludes(value, baseDir);
    }
    return result;
  }

  return obj;
}

/**
 * Validate GitOps configuration for templates that need it
 * Returns error message if validation fails, undefined if valid
 */
function validateGitOpsConfig(config: any, templateName: string): string | undefined {
  // Only validate for gitops-related templates
  if (!templateName || !templateName.includes('gitops')) {
    return undefined;
  }

  const gitopsConfig = config?.ingestor?.crossplane?.xrds?.gitops;

  if (!gitopsConfig) {
    return `GitOps template requires configuration in app-config/ingestor.yaml under:
  ingestor.crossplane.xrds.gitops

Example:
  kubernetesIngestor:
    crossplane:
      xrds:
        gitops:
          owner: 'your-org'
          repo: 'catalog-orders'
          targetBranch: 'main'`;
  }

  const missing: string[] = [];
  if (!gitopsConfig.owner) missing.push('owner');
  if (!gitopsConfig.repo) missing.push('repo');
  if (!gitopsConfig.targetBranch) missing.push('targetBranch');

  if (missing.length > 0) {
    return `GitOps configuration is incomplete. Missing required fields:
  ${missing.map(f => `- ingestor.crossplane.xrds.gitops.${f}`).join('\n  ')}

Please add these to app-config/ingestor.yaml`;
  }

  return undefined;
}

// Default to built-in templates (works for both ts-node and compiled)
// From src/xrd-transform/cli or dist/xrd-transform/cli -> go up 3 levels to package root
function getDefaultTemplateDir(): string {
  const templatePath = path.join(__dirname, '../../../templates');
  return templatePath;
}
const DEFAULT_TEMPLATE_DIR = getDefaultTemplateDir();

/**
 * Recursively copy directory
 */
async function copyDirectory(source: string, destination: string): Promise<void> {
  // Create destination directory
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  // Read source directory
  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy subdirectory
      await copyDirectory(srcPath, destPath);
    } else {
      // Copy file
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

program
  .name('xrd-transform')
  .description('Transform XRDs into Backstage templates using Handlebars templates')
  .version('1.0.0');

// Init command - copy default templates to project
program
  .command('init')
  .description('Initialize custom templates by copying defaults from npm package')
  .option('-o, --output <dir>', 'Output directory for templates', './ingestor-templates')
  .option('-f, --force', 'Overwrite existing templates')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    const outputDir = path.resolve(process.cwd(), options.output);

    // Check if directory already exists
    if (fs.existsSync(outputDir) && !options.force) {
      log(`✗ Template directory already exists: ${outputDir}`, 'yellow');
      log('  Use --force to overwrite', 'gray');
      process.exit(1);
    }

    try {
      // Copy templates from package
      await copyDirectory(DEFAULT_TEMPLATE_DIR, outputDir);

      log(`✓ Copied templates to ${outputDir}`, 'green');
      log('', 'reset');
      log('Next steps:', 'blue');
      log(`  1. Customize templates in ${options.output}/`, 'gray');
      log(`  2. Add to app-config/ingestor.yaml:`, 'gray');
      log('', 'reset');
      log('     ingestor:', 'gray');
      log('       crossplane:', 'gray');
      log('         xrds:', 'gray');
      log(`           templateDir: '${options.output}'`, 'gray');
      log('', 'reset');
      log(`  3. Test with CLI: npx ingestor path/to/xrd.yaml`, 'gray');
      log('  4. Restart Backstage: yarn start', 'gray');
    } catch (error) {
      log(`✗ Failed to copy templates: ${error}`, 'red');
      process.exit(1);
    }
  });

// Transform command (default)
program
  .command('transform', { isDefault: true })
  .description('Transform XRDs into Backstage templates')
  .argument('[input]', 'Input file or directory (or stdin if not provided)')
  .option('-c, --config <path>', 'Config file path (e.g., tests/app-config.test.yaml)')
  .option('-t, --template <name>', 'Template name to use (overrides XRD annotation, e.g., "debug", "default")')
  .option('--template-path <dir>', 'Template directory path (overrides config)')
  .option('-o, --output <dir>', 'Output directory (default: stdout)')
  .option('-f, --format <format>', 'Output format (yaml|json)', 'yaml')
  .option('--only <type>', 'Only generate specific entity type (template|api)')
  .option('--single-file', 'Output all entities to a single file')
  .option('--organize', 'Organize output by entity type')
  .option('-v, --verbose', 'Verbose output')
  .option('--validate', 'Validate output')
  .option('--watch', 'Watch for changes (when input is directory)')
  .action(async (input, options) => {
    try {
      // Load configuration for template directory and gitops settings
      const config = loadIngestorConfig(options.config);
      const configTemplateDir = config?.ingestor?.crossplane?.xrds?.templateDir;

      // Priority: CLI flag > config > built-in default
      let templateDir: string;
      if (options.templatePath) {
        // CLI flag takes highest priority
        templateDir = path.resolve(options.templatePath);
      } else if (configTemplateDir) {
        // Use config setting (resolve relative to cwd)
        templateDir = path.resolve(process.cwd(), configTemplateDir);
      } else {
        // Fall back to built-in templates
        templateDir = DEFAULT_TEMPLATE_DIR;
      }

      // Read input
      const xrdData = await readInput(input, options, config);

      if (!xrdData || xrdData.length === 0) {
        log('No XRD data found', 'yellow');
        process.exit(1);
      }

      // Check template directory exists
      if (!fs.existsSync(templateDir)) {
        log(`Template directory not found: ${templateDir}`, 'red');
        log('Creating default templates...', 'yellow');
        await createDefaultTemplates(templateDir);
      }

      // Transform
      if (options.verbose) {
        log(`Transforming ${xrdData.length} XRD(s)...`, 'blue');
        if (options.template) {
          log(`Using template override: ${options.template}`, 'blue');
        }
      }

      // Determine effective template name (override or default)
      const effectiveTemplateName = options.template || 'default';

      // Extract gitops configuration from already-loaded config
      let gitopsConfig = config?.ingestor?.crossplane?.xrds?.gitops || {};

      // Determine which template will be used (check XRD annotations or CLI override)
      let templateToUse = options.template;
      if (!templateToUse && xrdData.length > 0) {
        // Check first XRD for steps template annotation
        const firstXrd = xrdData[0].xrd;
        templateToUse = firstXrd?.metadata?.annotations?.['openportal.dev/template-steps'];
      }

      // Check for XRD-level parameter defaults via annotations
      // Pattern: openportal.dev/parameter.<paramName>: <value>
      if (xrdData.length > 0) {
        const firstXrd = xrdData[0].xrd;
        const annotations = firstXrd?.metadata?.annotations || {};
        const parameterDefaults: Record<string, string> = {};

        for (const [key, value] of Object.entries(annotations)) {
          if (key.startsWith('openportal.dev/parameter.')) {
            const paramName = key.replace('openportal.dev/parameter.', '');
            parameterDefaults[paramName] = value as string;
          }
        }

        // Apply parameter defaults to GitOps config (XRD annotations take precedence)
        if (parameterDefaults.gitopsOwner) {
          gitopsConfig.owner = parameterDefaults.gitopsOwner;
        }
        if (parameterDefaults.gitopsRepo) {
          gitopsConfig.repo = parameterDefaults.gitopsRepo;
        }
        if (parameterDefaults.gitopsTargetBranch) {
          gitopsConfig.targetBranch = parameterDefaults.gitopsTargetBranch;
        }

        if (Object.keys(parameterDefaults).length > 0 && options.verbose) {
          log(`Using XRD parameter defaults: ${JSON.stringify(parameterDefaults)}`, 'blue');
        }
      }

      // Validate configuration for gitops templates
      const configError = validateGitOpsConfig(config, templateToUse || '');
      if (configError) {
        log('Configuration Error:', 'red');
        log(configError, 'yellow');
        process.exit(1);
      }

      const result = await transform(xrdData, {
        templateDir,
        templateName: options.template,  // CLI override for main template name
        format: options.format,
        verbose: options.verbose,
        validate: options.validate,
        context: {
          config: {
            gitops: gitopsConfig
          }
        }
      });

      if (!result.success) {
        log('Transform failed:', 'red');
        result.errors?.forEach(error => log(`  - ${error}`, 'red'));
        process.exit(1);
      }

      // Filter entities by type if --only specified
      let entitiesToOutput = result.entities;
      if (options.only) {
        const filterType = options.only.toLowerCase();
        if (filterType === 'template') {
          entitiesToOutput = result.entities.filter((e: any) =>
            e.kind === 'Template'
          );
          if (options.verbose) {
            log(`Filtered to ${entitiesToOutput.length} Template entities`, 'blue');
          }
        } else if (filterType === 'api') {
          entitiesToOutput = result.entities.filter((e: any) =>
            e.kind === 'API'
          );
          if (options.verbose) {
            log(`Filtered to ${entitiesToOutput.length} API entities`, 'blue');
          }
        } else {
          log(`Warning: Unknown entity type '${options.only}', showing all entities`, 'yellow');
        }
      }

      // Output
      await writeOutput(entitiesToOutput, { ...options, effectiveTemplateName });

      if (options.verbose) {
        log(`✨ Generated ${entitiesToOutput.length} entities`, 'green');
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
 * Discover XRD files in a directory
 *
 * Searches for XRDs in common locations:
 * 1. configuration/xrd.yaml (Crossplane convention)
 * 2. xrd.yaml in root directory
 * 3. Any *.yaml or *.yml files that look like XRDs
 */
function discoverXRDs(dirPath: string): string[] {
  const xrdFiles: string[] = [];

  // Priority 1: Check for configuration/xrd.yaml (Crossplane template convention)
  const configXrdPath = path.join(dirPath, 'configuration', 'xrd.yaml');
  if (fs.existsSync(configXrdPath)) {
    xrdFiles.push(configXrdPath);
    return xrdFiles; // Found the canonical location, return it
  }

  // Priority 2: Check for xrd.yaml in the root
  const rootXrdPath = path.join(dirPath, 'xrd.yaml');
  if (fs.existsSync(rootXrdPath)) {
    xrdFiles.push(rootXrdPath);
    return xrdFiles;
  }

  // Priority 3: Scan for any YAML files that might be XRDs
  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

  for (const file of files) {
    const filePath = path.join(dirPath, file);

    // Quick check: does it look like an XRD?
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('kind: CompositeResourceDefinition') ||
          content.includes('apiextensions.crossplane.io')) {
        xrdFiles.push(filePath);
      }
    } catch {
      // Skip files we can't read
      continue;
    }
  }

  return xrdFiles;
}

/**
 * Read input from file, directory, or stdin
 */
async function readInput(input: string | undefined, options: any, config?: any): Promise<XRDExtractData[]> {
  const results: XRDExtractData[] = [];

  // Get current kubectl context for metadata (or use config override)
  const currentCluster = config?.ingestor?.crossplane?.xrds?.targetCluster || getCurrentKubectlContext();

  if (!input || input === '-') {
    // Read from stdin
    const stdinData = await readStdin();
    const parsed = parseInput(stdinData);

    if (isXRDExtractData(parsed)) {
      // Add cluster metadata if not present
      if (currentCluster && !parsed.metadata?.cluster) {
        parsed.metadata = { ...parsed.metadata, cluster: currentCluster };
      }
      results.push(parsed);
    } else if (Array.isArray(parsed)) {
      const filtered = parsed.filter(isXRDExtractData);
      // Add cluster metadata to each
      filtered.forEach(item => {
        if (currentCluster && !item.metadata?.cluster) {
          item.metadata = { ...item.metadata, cluster: currentCluster };
        }
      });
      results.push(...filtered);
    } else {
      // Assume it's a raw XRD
      results.push({
        source: 'stdin',
        timestamp: new Date().toISOString(),
        xrd: parsed,
        metadata: { cluster: currentCluster },
      });
    }
  } else if (fs.existsSync(input)) {
    const stat = fs.statSync(input);

    if (stat.isDirectory()) {
      // Discover XRD files in directory
      const xrdFiles = discoverXRDs(input);

      if (options.verbose) {
        log(`Found ${xrdFiles.length} XRD file(s)`, 'blue');
      }

      for (const filePath of xrdFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseInput(content);

        if (isXRDExtractData(parsed)) {
          // Add cluster metadata if not present
          if (currentCluster && !parsed.metadata?.cluster) {
            parsed.metadata = { ...parsed.metadata, cluster: currentCluster };
          }
          results.push(parsed);
        } else {
          // Assume it's a raw XRD
          results.push({
            source: 'file',
            timestamp: new Date().toISOString(),
            xrd: parsed,
            metadata: { path: filePath, cluster: currentCluster },
          });
        }
      }
    } else {
      // Read single file
      const content = fs.readFileSync(input, 'utf-8');
      const parsed = parseInput(content);

      if (isXRDExtractData(parsed)) {
        // Add cluster metadata if not present
        if (currentCluster && !parsed.metadata?.cluster) {
          parsed.metadata = { ...parsed.metadata, cluster: currentCluster };
        }
        results.push(parsed);
      } else if (Array.isArray(parsed)) {
        const filtered = parsed.filter(isXRDExtractData);
        // Add cluster metadata to each
        filtered.forEach(item => {
          if (currentCluster && !item.metadata?.cluster) {
            item.metadata = { ...item.metadata, cluster: currentCluster };
          }
        });
        results.push(...filtered);
      } else {
        // Assume it's a raw XRD
        results.push({
          source: 'file',
          timestamp: new Date().toISOString(),
          xrd: parsed,
          metadata: { path: input, cluster: currentCluster },
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
      // Remove internal fields before writing
      const { _xrdBaseName, ...entityToWrite } = entity;

      const output = format === 'json'
        ? JSON.stringify(entityToWrite, null, 2)
        : yaml.dump(entityToWrite);

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

      // Remove internal fields from all entities
      const cleanEntities = entities.map(({ _xrdBaseName, ...rest }) => rest);

      const content = format === 'json'
        ? JSON.stringify(cleanEntities, null, 2)
        : cleanEntities.map(e => yaml.dump(e)).join('---\n');

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

        // Remove internal fields before writing
        const { _xrdBaseName, ...entityToWrite } = entity;

        const content = format === 'json'
          ? JSON.stringify(entityToWrite, null, 2)
          : yaml.dump(entityToWrite);

        fs.writeFileSync(filepath, content);

        if (options.verbose) {
          log(`Wrote ${filepath}`, 'gray');
        }
      }
    } else {
      // Write each entity to separate file
      for (const entity of entities) {
        // Build kind suffix: template-kind pattern for clarity
        const entityKind = entity.kind?.toLowerCase();
        const templateName = options.effectiveTemplateName; // Always available (default or override)

        let kindSuffix: string;
        if (entityKind) {
          // Standard entity: template-kind (e.g., default-template, default-api, debug-template)
          kindSuffix = `${templateName}-${entityKind}`;
        } else {
          // Non-standard entity (like debug output): just template name
          kindSuffix = templateName;
        }

        // Use base XRD name (set by transform) or fallback to entity/debug metadata
        // Priority: _xrdBaseName (standard entities) → xrd_metadata.name (debug) → metadata.name → 'output'
        const baseName = entity._xrdBaseName
                      || entity.xrd_metadata?.name
                      || entity.metadata?.name
                      || 'output';

        const filename = `${baseName}-${kindSuffix}.${format}`;
        const filepath = path.join(options.output, filename);

        // Remove internal fields before writing
        const { _xrdBaseName, ...entityToWrite } = entity;

        const content = format === 'json'
          ? JSON.stringify(entityToWrite, null, 2)
          : yaml.dump(entityToWrite);

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
  fs.watch(dir, async (_eventType, filename) => {
    if (filename && (filename.endsWith('.json') || filename.endsWith('.yaml') || filename.endsWith('.yml'))) {
      log(`Change detected: ${filename}`, 'yellow');

      try {
        const templateDir = options.templates || DEFAULT_TEMPLATE_DIR;
        const xrdData = await readInput(dir, options);
        const result = await transform(xrdData, {
          templateDir,
          format: options.format,
          verbose: options.verbose,
          validate: options.validate,
        });

        if (result.success) {
          // Filter entities by type if --only specified
          let entitiesToOutput = result.entities;
          if (options.only) {
            const filterType = options.only.toLowerCase();
            if (filterType === 'template') {
              entitiesToOutput = result.entities.filter((e: any) => e.kind === 'Template');
            } else if (filterType === 'api') {
              entitiesToOutput = result.entities.filter((e: any) => e.kind === 'API');
            }
          }

          await writeOutput(entitiesToOutput, options);
          log(`✨ Regenerated ${entitiesToOutput.length} entities`, 'green');
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