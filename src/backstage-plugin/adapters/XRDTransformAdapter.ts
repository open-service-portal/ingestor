/**
 * Adapter to integrate xrd-transform with Backstage entity providers
 */

import { Entity } from '@backstage/catalog-model';
import { XRDTransformer } from '../../xrd-transform/lib/transform';
import { XRDExtractData, TransformOptions } from '../../xrd-transform/lib/types';
import * as path from 'path';

export class XRDTransformAdapter {
  private transformer: XRDTransformer;

  constructor(options?: { templateDir?: string }) {
    // Default to built-in templates if not specified
    const templateDir = options?.templateDir || path.join(__dirname, '../../xrd-transform/templates');

    this.transformer = new XRDTransformer({
      templateDir,
    });
  }

  /**
   * Transform an XRD into Backstage entities using templates
   */
  async transformXRD(xrd: any, options?: {
    cluster?: string;
    namespace?: string;
    owner?: string;
    tags?: string[];
  }): Promise<Entity[]> {
    // Prepare extract data in the format expected by xrd-transform
    const extractData: XRDExtractData = {
      source: options?.cluster ? `kubernetes:${options.cluster}` : 'kubernetes',
      timestamp: new Date().toISOString(),
      xrd,
      metadata: {
        cluster: options?.cluster,
        namespace: options?.namespace,
      },
    };

    // Transform with additional context
    const transformOptions: Partial<TransformOptions> = {
      context: {
        owner: options?.owner || 'platform-team',
        tags: options?.tags || [],
      },
    };

    const result = await this.transformer.transform(extractData, transformOptions);

    if (!result.success) {
      throw new Error(`Failed to transform XRD: ${result.errors?.join(', ')}`);
    }

    return result.entities as Entity[];
  }

  /**
   * Transform multiple XRDs in batch
   */
  async transformXRDs(xrds: any[], options?: {
    cluster?: string;
    namespace?: string;
    owner?: string;
    tags?: string[];
  }): Promise<Entity[]> {
    const allEntities: Entity[] = [];

    for (const xrd of xrds) {
      try {
        const entities = await this.transformXRD(xrd, options);
        allEntities.push(...entities);
      } catch (error) {
        // Log error but continue with other XRDs
        console.error(`Failed to transform XRD ${xrd?.metadata?.name}: ${error}`);
      }
    }

    return allEntities;
  }

  /**
   * Check if template-based transform is enabled
   */
  static isEnabled(config: any): boolean {
    return config.getOptionalBoolean('kubernetesIngestor.transform.useTemplates') ?? false;
  }

  /**
   * Get template directory from config
   */
  static getTemplateDir(config: any): string | undefined {
    return config.getOptionalString('kubernetesIngestor.transform.templateDir');
  }
}