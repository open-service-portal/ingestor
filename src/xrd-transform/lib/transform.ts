/**
 * Core XRD Transform Library
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  XRDExtractData,
  TransformOptions,
  TransformResult,
  TemplateConfig
} from './types';
import { createHelpers } from '../helpers';

import * as Handlebars from 'handlebars';

// Default template directory (at package root/templates)
// Works for both ts-node (src/xrd-transform/lib) and compiled (dist/xrd-transform/lib)
function getDefaultTemplateDir(): string {
  // From src/xrd-transform/lib -> go up 3 levels to package root
  const srcPath = path.join(__dirname, '../../../templates');
  // From dist/xrd-transform/lib -> go up 3 levels to package root
  const distPath = path.join(__dirname, '../../../templates');

  if (fs.existsSync(srcPath)) {
    return srcPath;
  }
  return distPath;
}

const DEFAULT_TEMPLATE_DIR = getDefaultTemplateDir();

export class XRDTransformer {
  private handlebars: typeof Handlebars;
  private templateDir: string;
  private templateNameOverride?: string;
  private helpers: ReturnType<typeof createHelpers>;

  constructor(options?: TransformOptions) {
    this.templateDir = options?.templateDir || DEFAULT_TEMPLATE_DIR;
    this.templateNameOverride = options?.templateName;
    this.helpers = createHelpers();
    this.handlebars = Handlebars.create();

    // Register helpers with Handlebars
    this.registerHelpers();
  }

  private registerHelpers(): void {
    // Register all helper functions with Handlebars
    Object.entries(this.helpers).forEach(([name, fn]) => {
      this.handlebars.registerHelper(name, fn);
    });

    // Register additional useful helpers
    this.handlebars.registerHelper('json', (value: any) => {
      return JSON.stringify(value);
    });

    this.handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    this.handlebars.registerHelper('includes', (array: any[], value: any) => {
      return array && array.includes(value);
    });

    // Helper to preserve Backstage template variables
    this.handlebars.registerHelper('backstageVar', (varName: string) => {
      return `\${{ ${varName} }}`;
    });

    // Helper to generate Backstage expression with config fallback
    // Usage: {{backstageConfigFallback "parameters.gitopsOwner" config.gitops.owner}}
    // Output: ${{ parameters.gitopsOwner || 'open-service-portal' }}
    this.handlebars.registerHelper('backstageConfigFallback', (paramPath: string, configValue: any) => {
      // Build the expression with the actual config value (evaluated during template generation)
      return `\${{ ${paramPath} || '${configValue || ''}' }}`;
    });

    // Helper to build GitHub repoUrl with config fallbacks
    // Usage: {{gitopsRepoUrl config.gitops}}
    // Output: "github.com?owner=${{ parameters.gitopsOwner || 'owner' }}&repo=${{ parameters.gitopsRepo || 'repo' }}"
    this.handlebars.registerHelper('gitopsRepoUrl', (gitopsConfig: any) => {
      const owner = gitopsConfig?.owner || '';
      const repo = gitopsConfig?.repo || '';
      // Wrap in quotes to prevent YAML folding and keep expression on single line
      return `"github.com?owner=\${{ parameters.gitopsOwner || '${owner}' }}&repo=\${{ parameters.gitopsRepo || '${repo}' }}"`;
    });

    // String manipulation helpers
    this.handlebars.registerHelper('split', (str: string, delimiter: string) => {
      if (!str) return [];
      return str.split(delimiter);
    });

    this.handlebars.registerHelper('trim', (str: string) => {
      if (!str) return '';
      return str.trim();
    });

    this.handlebars.registerHelper('concat', (...args: any[]) => {
      // Remove the Handlebars options object (last argument)
      const strings = args.slice(0, -1);
      return strings.join('');
    });

    this.handlebars.registerHelper('replace', (str: string, search: string, replace: string) => {
      if (!str) return '';
      // Use replaceAll to replace all occurrences
      return str.split(search).join(replace);
    });

    // Helper to indent multiline content
    this.handlebars.registerHelper('indent', (str: string, spaces: number) => {
      if (!str) return '';
      const indentation = ' '.repeat(spaces || 0);
      return str.split('\n').map(line => line ? indentation + line : line).join('\n');
    });
  }

  /**
   * Transform XRD data into Backstage entities
   */
  async transform(xrdData: XRDExtractData, options?: Partial<TransformOptions>): Promise<TransformResult> {

    const errors: string[] = [];
    const entities: any[] = [];

    try {
      const xrd = xrdData.xrd;

      // Get template configuration from XRD annotations
      const templateConfig = this.getTemplateConfig(xrd);

      // Use 'default' template if no template name provided (empty/undefined), but respect explicit names
      const backstageTemplateName = templateConfig.backstageTemplate || 'default';
      const parametersTemplateName = templateConfig.parametersTemplate || 'default';
      const stepsTemplateName = templateConfig.stepsTemplate || 'default';
      const outputTemplateName = templateConfig.outputTemplate || stepsTemplateName; // Default to same as steps

      // Prepare base context (without rendered sub-templates)
      const context = {
        xrd,
        metadata: xrdData.metadata,
        helpers: this.helpers,
        source: xrdData.source,
        timestamp: xrdData.timestamp,
        ...options?.context,
      };

      // Generate Backstage template with YAML merge approach
      try {
        // 1. Render main template (provides metadata + base spec)
        const mainTemplate = await this.generateBackstageTemplate(
          backstageTemplateName,
          context
        );

        // 2. Render sub-templates (provide spec.parameters/steps/output)
        const parametersRendered = await this.renderMultipleSubTemplates(
          'parameters',
          parametersTemplateName,
          context
        );
        const stepsRendered = await this.renderMultipleSubTemplates(
          'steps',
          stepsTemplateName,
          context
        );
        const outputRendered = await this.renderMultipleSubTemplates(
          'output',
          outputTemplateName,
          context
        );

        // 3. Parse sub-templates to objects
        const parametersObj = yaml.load(parametersRendered) || {};
        const stepsObj = yaml.load(stepsRendered) || {};
        const outputObj = yaml.load(outputRendered) || {};

        // 4. Merge all templates (main + sub-templates)
        const backstageTemplate = this.deepMergeYaml([
          mainTemplate,
          parametersObj,
          stepsObj,
          outputObj
        ]);

        if (backstageTemplate) {
          // Add base XRD name for clean filename generation
          backstageTemplate._xrdBaseName = this.helpers.slugify(xrd.metadata.name);
          entities.push(backstageTemplate);
        }
      } catch (error) {
        errors.push(`Failed to generate Backstage template: ${error}`);
      }

      // Generate API documentation (optional)
      try {
        const apiDoc = await this.generateAPIDoc(xrd, context);
        if (apiDoc) {
          // Add base XRD name for clean filename generation
          apiDoc._xrdBaseName = this.helpers.slugify(xrd.metadata.name);
          entities.push(apiDoc);
        }
      } catch (error) {
        // API doc is optional, log error for debugging
        console.error(`Failed to generate API doc for ${xrd.metadata.name}: ${error}`);
        if (options?.verbose) {
          console.error((error as Error).stack);
        }
      }

      return {
        success: errors.length === 0,
        entities,
        errors: errors.length > 0 ? errors : undefined,
      };

    } catch (error) {
      return {
        success: false,
        entities: [],
        errors: [`Transform failed: ${error}`],
      };
    }
  }

  /**
   * Get template configuration from XRD annotations
   */
  private getTemplateConfig(xrd: any): TemplateConfig {
    const annotations = xrd?.metadata?.annotations || {};

    return {
      // CLI override takes precedence over annotation
      backstageTemplate: this.templateNameOverride || annotations['openportal.dev/template'],
      apiTemplate: this.templateNameOverride || annotations['openportal.dev/template-api'],
      parametersTemplate: this.templateNameOverride || annotations['openportal.dev/template-parameters'],
      stepsTemplate: this.templateNameOverride || annotations['openportal.dev/template-steps'],
      outputTemplate: this.templateNameOverride || annotations['openportal.dev/template-output'],
    };
  }

  /**
   * Load and register a sub-template as a Handlebars partial
   */
  private loadPartial(partialName: string, templatePath: string): void {
    const fullPath = path.join(this.templateDir, templatePath);

    if (!fs.existsSync(fullPath)) {
      // Partial is optional, just skip if not found
      return;
    }

    const templateSource = fs.readFileSync(fullPath, 'utf-8');
    this.handlebars.registerPartial(partialName, templateSource);
  }

  /**
   * Render multiple comma-separated sub-templates and merge them
   * Supports building block pattern like "gitops,download" or "metadata,crossplane"
   */
  private async renderMultipleSubTemplates(
    type: 'parameters' | 'steps' | 'output',
    templateNames: string,
    context: any
  ): Promise<string> {
    // Split by comma and trim whitespace
    const names = templateNames.split(',').map(n => n.trim()).filter(n => n.length > 0);

    // Single template - no merging needed
    if (names.length === 1) {
      return this.renderSubTemplate(type, names[0], context);
    }

    // Render each template
    const rendered = await Promise.all(
      names.map(name => this.renderSubTemplate(type, name, context))
    );

    // Parse each YAML string and merge
    const parsed = rendered.map(yamlStr => {
      try {
        return yaml.load(yamlStr.trim()) || {};
      } catch (error) {
        console.error(`Failed to parse template output: ${error}`);
        return {};
      }
    });

    // Deep merge all parsed structures
    const merged = this.deepMergeYaml(parsed);

    // Serialize back to YAML string
    return yaml.dump(merged, { lineWidth: -1, noRefs: true });
  }

  /**
   * Deep merge multiple YAML objects
   * Arrays are concatenated, objects are merged recursively
   */
  private deepMergeYaml(objects: any[]): any {
    if (objects.length === 0) return {};
    if (objects.length === 1) return objects[0];

    const result: any = {};

    for (const obj of objects) {
      if (!obj || typeof obj !== 'object') continue;

      for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;

        const value = obj[key];

        if (!(key in result)) {
          // New key - just set it
          result[key] = value;
        } else if (Array.isArray(result[key]) && Array.isArray(value)) {
          // Both arrays - concatenate
          result[key] = [...result[key], ...value];
        } else if (
          typeof result[key] === 'object' &&
          !Array.isArray(result[key]) &&
          typeof value === 'object' &&
          !Array.isArray(value)
        ) {
          // Both objects - merge recursively
          result[key] = this.deepMergeYaml([result[key], value]);
        } else {
          // Conflict - later value wins
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Render a sub-template (parameters, steps, or output)
   */
  private async renderSubTemplate(
    type: 'parameters' | 'steps' | 'output',
    templateName: string,
    context: any
  ): Promise<string> {
    const templatePath = path.join(type, `${templateName}.hbs`);
    const fullPath = path.join(this.templateDir, templatePath);

    if (!fs.existsSync(fullPath)) {
      // Fall back to default
      const defaultPath = path.join(this.templateDir, type, 'default.hbs');
      if (!fs.existsSync(defaultPath)) {
        throw new Error(`${type} template not found: ${templateName} (and no default.hbs)`);
      }
      const defaultSource = fs.readFileSync(defaultPath, 'utf-8');
      const template = this.handlebars.compile(defaultSource);
      return template(context);
    }

    const templateSource = fs.readFileSync(fullPath, 'utf-8');
    const template = this.handlebars.compile(templateSource);
    return template(context);
  }

  /**
   * Generate Backstage template using Handlebars
   */
  private async generateBackstageTemplate(templateName: string, context: any): Promise<any> {
    // Check if template exists
    const templatePath = path.join('backstage', `${templateName}.hbs`);
    const fullPath = path.join(this.templateDir, templatePath);

    if (!fs.existsSync(fullPath)) {
      // No fallback - template must exist
      throw new Error(`Backstage template not found: ${templateName} (${fullPath})`);
    }

    // Read and compile the template
    const templateSource = fs.readFileSync(fullPath, 'utf-8');
    const template = this.handlebars.compile(templateSource);

    // Render the template
    const rendered = template(context);

    // Parse the rendered YAML/JSON
    try {
      return yaml.load(rendered);
    } catch (yamlError) {
      // Try JSON if YAML fails
      try {
        return JSON.parse(rendered);
      } catch (jsonError) {
        throw new Error(`Failed to parse template output as YAML or JSON: ${yamlError}`);
      }
    }
  }

  /**
   * Generate API documentation entity
   */
  private async generateAPIDoc(xrd: any, context: any): Promise<any | null> {
    // Get template name from config (respects CLI override)
    const templateConfig = this.getTemplateConfig(xrd);
    const templateName = templateConfig.apiTemplate || 'default';

    const apiTemplatePath = path.join(this.templateDir, 'api', `${templateName}.hbs`);

    if (!fs.existsSync(apiTemplatePath)) {
      return null; // API doc is optional - skip if template doesn't exist
    }

    const templateSource = fs.readFileSync(apiTemplatePath, 'utf-8');
    const template = this.handlebars.compile(templateSource);
    const rendered = template(context);

    try {
      return yaml.load(rendered);
    } catch (error) {
      console.error(`Failed to parse API template for ${xrd.metadata.name}: ${error}`);
      return null;
    }
  }

  /**
   * Transform multiple XRDs
   */
  async transformBatch(xrdDataArray: XRDExtractData[], options?: Partial<TransformOptions>): Promise<TransformResult> {
    const allEntities: any[] = [];
    const allErrors: string[] = [];

    for (const xrdData of xrdDataArray) {
      const result = await this.transform(xrdData, options);

      allEntities.push(...result.entities);
      if (result.errors) {
        allErrors.push(...result.errors);
      }
    }

    return {
      success: allErrors.length === 0,
      entities: allEntities,
      errors: allErrors.length > 0 ? allErrors : undefined,
    };
  }
}

/**
 * Convenience function to create and use transformer
 */
export async function transform(
  xrdData: XRDExtractData | XRDExtractData[],
  options: TransformOptions
): Promise<TransformResult> {
  const transformer = new XRDTransformer(options);

  if (Array.isArray(xrdData)) {
    return transformer.transformBatch(xrdData, options);
  } else {
    return transformer.transform(xrdData, options);
  }
}