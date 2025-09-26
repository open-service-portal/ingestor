/**
 * XRD Entity Builder - converts XRDs to Backstage entities
 * This implementation is shared between CLI and runtime
 */

import { Entity } from '@backstage/catalog-model';
import {
  IEntityBuilder,
  Resource,
  XRD,
  EntityBuilderConfig,
} from '../engine/interfaces';

interface TemplateEntity extends Entity {
  apiVersion: 'backstage.io/v1beta3';
  kind: 'Template';
  spec: {
    owner: string;
    type: string;
    parameters: any[];
    steps: any[];
  };
}

interface ApiEntity extends Entity {
  apiVersion: 'backstage.io/v1alpha1';
  kind: 'API';
  spec: {
    type: string;
    lifecycle: string;
    owner: string;
    definition: string | any;
  };
}

export class XRDEntityBuilder implements IEntityBuilder {
  /**
   * Check if this builder can handle the resource
   */
  canBuild(resource: Resource): boolean {
    return resource.kind === 'CompositeResourceDefinition';
  }

  /**
   * Build Backstage entities from XRD
   */
  async build(
    resource: Resource,
    config?: EntityBuilderConfig
  ): Promise<Entity[]> {
    const xrd = resource as XRD;
    const entities: Entity[] = [];

    // Build template entity
    const template = this.buildTemplate(xrd, config);
    if (template) {
      entities.push(template);
    }

    // Build API entity
    const api = this.buildAPI(xrd, config);
    if (api) {
      entities.push(api);
    }

    return entities;
  }

  /**
   * Build a Template entity from XRD
   */
  private buildTemplate(
    xrd: XRD,
    config?: EntityBuilderConfig
  ): TemplateEntity | null {
    // Skip if no served versions
    const servedVersion = xrd.spec.versions.find(v => v.served);
    if (!servedVersion) {
      return null;
    }

    const name = this.generateTemplateName(xrd);
    const title = this.generateTitle(xrd);
    const description = this.generateDescription(xrd);
    const tags = this.generateTags(xrd, config);

    // Extract parameters from schema
    const parameters = this.extractParameters(xrd, servedVersion);

    // Generate steps for the template
    const steps = this.generateSteps(xrd);

    const template: TemplateEntity = {
      apiVersion: 'backstage.io/v1beta3',
      kind: 'Template',
      metadata: {
        name,
        title,
        description,
        tags,
        annotations: {
          'backstage.io/managed-by': 'ingestor',
          'crossplane.io/xrd-name': xrd.metadata.name,
          'crossplane.io/xrd-group': xrd.spec.group,
        },
        ...(config?.namespace && { namespace: config.namespace }),
      },
      spec: {
        owner: config?.owner || 'platform-team',
        type: 'crossplane-resource',
        parameters,
        steps,
      },
    };

    // Add additional metadata if provided
    if (config?.additionalMetadata) {
      Object.assign(template.metadata, config.additionalMetadata);
    }

    return template;
  }

  /**
   * Build an API entity from XRD
   */
  private buildAPI(xrd: XRD, config?: EntityBuilderConfig): ApiEntity | null {
    const servedVersion = xrd.spec.versions.find(v => v.served);
    if (!servedVersion) {
      return null;
    }

    const name = `${xrd.metadata.name}-api`;
    const title = `${this.generateTitle(xrd)} API`;
    const description = `API specification for ${xrd.spec.names.kind}`;
    const tags = this.generateTags(xrd, config);

    // Generate OpenAPI spec from XRD schema
    const definition = this.generateOpenAPISpec(xrd, servedVersion);

    const api: ApiEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: {
        name,
        title,
        description,
        tags,
        annotations: {
          'backstage.io/managed-by': 'ingestor',
          'crossplane.io/xrd-name': xrd.metadata.name,
        },
        ...(config?.namespace && { namespace: config.namespace }),
      },
      spec: {
        type: 'openapi',
        lifecycle: servedVersion.name,
        owner: config?.owner || 'platform-team',
        definition,
      },
    };

    return api;
  }

  /**
   * Generate template name from XRD
   */
  private generateTemplateName(xrd: XRD): string {
    // Use XRD name, converting to lowercase and replacing dots
    return xrd.metadata.name.toLowerCase().replace(/\./g, '-');
  }

  /**
   * Generate human-readable title
   */
  private generateTitle(xrd: XRD): string {
    // Use the kind from XRD names, adding spaces between words
    const kind = xrd.spec.names.kind;
    return kind.replace(/([A-Z])/g, ' $1').trim();
  }

  /**
   * Generate description from XRD
   */
  private generateDescription(xrd: XRD): string {
    // Check for description in annotations
    const annotations = xrd.metadata.annotations || {};
    if (annotations.description) {
      return annotations.description;
    }

    // Generate default description
    return `Create and manage ${xrd.spec.names.kind} resources`;
  }

  /**
   * Generate tags for the entity
   */
  private generateTags(xrd: XRD, config?: EntityBuilderConfig): string[] {
    const tags: string[] = ['crossplane', 'ingestor'];

    // Add XRD categories if present
    if (xrd.spec.names.categories) {
      tags.push(...xrd.spec.names.categories);
    }

    // Add group as tag
    const group = xrd.spec.group.split('.')[0];
    if (group) {
      tags.push(group);
    }

    // Add config tags
    if (config?.tags) {
      tags.push(...config.tags);
    }

    // Remove duplicates
    return [...new Set(tags)];
  }

  /**
   * Extract parameters from XRD schema
   */
  private extractParameters(xrd: XRD, version: any): any[] {
    const parameters: any[] = [];

    // Add basic parameter section
    parameters.push({
      title: 'Basic Information',
      required: ['name'],
      properties: {
        name: {
          title: 'Name',
          type: 'string',
          description: `Name of the ${xrd.spec.names.kind}`,
          pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
        },
        namespace: {
          title: 'Namespace',
          type: 'string',
          description: 'Kubernetes namespace',
          default: 'default',
        },
      },
    });

    // Extract parameters from OpenAPI schema if available
    if (version.schema?.openAPIV3Schema?.properties?.spec) {
      const specSchema = version.schema.openAPIV3Schema.properties.spec;
      const specParams = this.schemaToParameters(specSchema);

      if (Object.keys(specParams.properties).length > 0) {
        parameters.push({
          title: 'Resource Configuration',
          ...specParams,
        });
      }
    }

    return parameters;
  }

  /**
   * Convert OpenAPI schema to Backstage parameters
   */
  private schemaToParameters(schema: any): any {
    const params: any = {
      properties: {},
      required: schema.required || [],
    };

    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        const property = prop as any;

        // Skip complex nested objects for now
        if (property.type === 'object' && property.properties) {
          // For simple objects, flatten one level
          if (this.isSimpleObject(property)) {
            for (const [subKey, subProp] of Object.entries(property.properties)) {
              const subProperty = subProp as any;
              params.properties[`${key}_${subKey}`] = {
                title: this.humanizeKey(`${key} ${subKey}`),
                type: subProperty.type || 'string',
                description: subProperty.description,
                ...(subProperty.default && { default: subProperty.default }),
                ...(subProperty.enum && { enum: subProperty.enum }),
              };
            }
          }
        } else if (property.type !== 'array') {
          // Add simple properties
          params.properties[key] = {
            title: this.humanizeKey(key),
            type: property.type || 'string',
            description: property.description,
            ...(property.default && { default: property.default }),
            ...(property.enum && { enum: property.enum }),
          };
        }
      }
    }

    return params;
  }

  /**
   * Check if object schema is simple (no nested objects)
   */
  private isSimpleObject(schema: any): boolean {
    if (!schema.properties) return true;

    for (const prop of Object.values(schema.properties)) {
      const property = prop as any;
      if (property.type === 'object' || property.type === 'array') {
        return false;
      }
    }
    return true;
  }

  /**
   * Convert key to human-readable format
   */
  private humanizeKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  /**
   * Generate steps for the template
   */
  private generateSteps(xrd: XRD): any[] {
    const steps: any[] = [];

    // Step 1: Fetch base template
    steps.push({
      id: 'fetch-base',
      name: 'Fetch Base',
      action: 'fetch:template',
      input: {
        url: './content',
        values: {
          name: '${{ parameters.name }}',
          namespace: '${{ parameters.namespace }}',
        },
      },
    });

    // Step 2: Generate resource YAML
    steps.push({
      id: 'generate-resource',
      name: `Generate ${xrd.spec.names.kind}`,
      action: 'crossplane:create-resource',
      input: {
        apiVersion: `${xrd.spec.group}/${xrd.spec.versions[0].name}`,
        kind: xrd.spec.names.kind,
        metadata: {
          name: '${{ parameters.name }}',
          namespace: '${{ parameters.namespace }}',
        },
        spec: '${{ parameters }}',
      },
    });

    // Step 3: Register in catalog (optional)
    steps.push({
      id: 'register',
      name: 'Register in Catalog',
      action: 'catalog:register',
      input: {
        repoContentsUrl: '${{ steps["publish"].output.repoContentsUrl }}',
        catalogInfoPath: '/catalog-info.yaml',
      },
    });

    return steps;
  }

  /**
   * Generate OpenAPI specification from XRD
   */
  private generateOpenAPISpec(xrd: XRD, version: any): any {
    return {
      openapi: '3.0.0',
      info: {
        title: `${xrd.spec.names.kind} API`,
        version: version.name,
        description: `OpenAPI specification for ${xrd.spec.names.kind}`,
      },
      paths: {
        [`/${xrd.spec.names.plural}`]: {
          get: {
            summary: `List ${xrd.spec.names.plural}`,
            responses: {
              '200': {
                description: 'Success',
              },
            },
          },
          post: {
            summary: `Create ${xrd.spec.names.kind}`,
            requestBody: {
              content: {
                'application/json': {
                  schema: version.schema?.openAPIV3Schema || {},
                },
              },
            },
            responses: {
              '201': {
                description: 'Created',
              },
            },
          },
        },
      },
    };
  }
}

/**
 * Factory function to create an XRD entity builder
 */
export function createXRDEntityBuilder(): IEntityBuilder {
  return new XRDEntityBuilder();
}