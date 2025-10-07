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

    // String manipulation helpers
    this.handlebars.registerHelper('split', (str: string, delimiter: string) => {
      if (!str) return [];
      return str.split(delimiter);
    });

    this.handlebars.registerHelper('trim', (str: string) => {
      if (!str) return '';
      return str.trim();
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

      // Render sub-templates (parameters and steps)
      const parametersRendered = await this.renderSubTemplate(
        'parameters',
        parametersTemplateName,
        { xrd, metadata: xrdData.metadata, helpers: this.helpers, source: xrdData.source, timestamp: xrdData.timestamp }
      );

      const stepsRendered = await this.renderSubTemplate(
        'steps',
        stepsTemplateName,
        { xrd, metadata: xrdData.metadata, helpers: this.helpers, source: xrdData.source, timestamp: xrdData.timestamp }
      );

      // Prepare template context with rendered sub-templates
      const context = {
        xrd,
        metadata: xrdData.metadata,
        helpers: this.helpers,
        source: xrdData.source,
        timestamp: xrdData.timestamp,
        parametersRendered,  // Pre-rendered parameters section
        stepsRendered,       // Pre-rendered steps section
        ...options?.context,
      };

      // Generate Backstage template
      try {
        const backstageTemplate = await this.generateBackstageTemplate(
          backstageTemplateName,
          context
        );

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
        // API doc is optional, just log warning
        if (options?.verbose) {
          console.warn(`Could not generate API doc: ${error}`);
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
      backstageTemplate: this.templateNameOverride || annotations['backstage.io/template'],
      apiTemplate: this.templateNameOverride || annotations['backstage.io/api-template'],
      parametersTemplate: this.templateNameOverride || annotations['backstage.io/parameters-template'],
      stepsTemplate: this.templateNameOverride || annotations['backstage.io/steps-template'],
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
   * Render a sub-template (parameters or steps)
   */
  private async renderSubTemplate(
    type: 'parameters' | 'steps',
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