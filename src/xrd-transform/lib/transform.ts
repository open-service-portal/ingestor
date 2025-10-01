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
  private helpers: ReturnType<typeof createHelpers>;

  constructor(options?: TransformOptions) {
    this.templateDir = options?.templateDir || DEFAULT_TEMPLATE_DIR;
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

      // Prepare template context
      const context = {
        xrd,
        metadata: xrdData.metadata,
        helpers: this.helpers,
        source: xrdData.source,
        timestamp: xrdData.timestamp,
        ...options?.context,
      };

      // Generate Backstage template
      try {
        const backstageTemplate = await this.generateBackstageTemplate(
          templateConfig.backstageTemplate || 'default',
          context
        );

        if (backstageTemplate) {
          entities.push(backstageTemplate);
        }
      } catch (error) {
        errors.push(`Failed to generate Backstage template: ${error}`);
      }

      // Generate API documentation (optional)
      try {
        const apiDoc = await this.generateAPIDoc(xrd, context);
        if (apiDoc) {
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
      backstageTemplate: annotations['backstage.io/template'],
      wizardTemplate: annotations['backstage.io/wizard'],
      stepsTemplate: annotations['backstage.io/steps'],
    };
  }

  /**
   * Generate Backstage template using Eta
   */
  private async generateBackstageTemplate(templateName: string, context: any): Promise<any> {
    // Check if template exists
    const templatePath = path.join('backstage', `${templateName}.hbs`);
    const fullPath = path.join(this.templateDir, templatePath);

    if (!fs.existsSync(fullPath)) {
      // Fall back to default template
      const defaultPath = path.join(this.templateDir, 'backstage', 'default.hbs');
      if (!fs.existsSync(defaultPath)) {
        throw new Error(`Template not found: ${templateName} (and no default.hbs)`);
      }
    }

    // Read and compile the template
    const finalTemplatePath = fs.existsSync(fullPath) ? fullPath : path.join(this.templateDir, 'backstage', 'default.hbs');
    const templateSource = fs.readFileSync(finalTemplatePath, 'utf-8');
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
    const apiTemplatePath = path.join(this.templateDir, 'api', 'default.hbs');

    if (!fs.existsSync(apiTemplatePath)) {
      return null; // API doc is optional
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