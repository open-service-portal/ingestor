import { BaseBuilder } from './BaseBuilder';

interface Parameter {
  title: string;
  required?: string[];
  properties?: Record<string, any>;
  dependencies?: Record<string, any>;
  type: string;
}

/**
 * Builder for creating scaffolder template parameters
 */
export class ParametersBuilder extends BaseBuilder<Parameter[]> {
  constructor() {
    super([]);
  }

  /**
   * Add resource metadata parameters (name, namespace, owner)
   */
  addResourceMetadata(options: {
    includeNamespace?: boolean;
    nameParam?: string;
    namespaceParam?: string;
    ownerParam?: string;
  } = {}): this {
    const nameParam = options.nameParam || 'xrName';
    const namespaceParam = options.namespaceParam || 'xrNamespace';
    const ownerParam = options.ownerParam || 'owner';

    const properties: Record<string, any> = {
      [nameParam]: {
        title: 'Name',
        description: 'The name of the resource',
        pattern: "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$",
        maxLength: 63,
        type: 'string',
      },
      [ownerParam]: {
        title: 'Owner',
        description: 'The owner of the resource',
        type: 'string',
        'ui:field': 'OwnerPicker',
        'ui:options': {
          'catalogFilter': {
            'kind': 'Group',
          },
        },
      },
    };

    const required = [nameParam, ownerParam];

    if (options.includeNamespace !== false) {
      properties[namespaceParam] = {
        title: 'Namespace',
        description: 'The namespace in which to create the resource',
        pattern: "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$",
        maxLength: 63,
        type: 'string',
      };
      required.push(namespaceParam);
    }

    this.data.push({
      title: 'Resource Metadata',
      required,
      properties,
      type: 'object',
    });

    return this;
  }

  /**
   * Add spec parameters from OpenAPI schema
   */
  addSpecParameters(schema: any, options: {
    convertDefaultsToPlaceholders?: boolean;
  } = {}): this {
    const processProperties = (properties: Record<string, any>): Record<string, any> => {
      const processedProperties: Record<string, any> = {};

      for (const [key, value] of Object.entries(properties)) {
        const typedValue = value as Record<string, any>;

        // Handle fields with x-kubernetes-preserve-unknown-fields: true
        if (typedValue['x-kubernetes-preserve-unknown-fields'] === true && !typedValue.type) {
          processedProperties[key] = {
            ...typedValue,
            type: 'string',
            'ui:widget': 'textarea',
            'ui:options': {
              rows: 10,
            },
          };
        } else if (typedValue.type === 'object' && typedValue.properties) {
          const subProperties = processProperties(typedValue.properties);
          processedProperties[key] = { ...typedValue, properties: subProperties };
        } else {
          if (options.convertDefaultsToPlaceholders &&
              typedValue.default !== undefined &&
              typedValue.type !== 'boolean') {
            processedProperties[key] = {
              ...typedValue,
              'ui:placeholder': typedValue.default
            };
            delete processedProperties[key].default;
          } else {
            processedProperties[key] = typedValue;
          }
        }
      }

      return processedProperties;
    };

    const processedSpec = schema?.openAPIV3Schema?.properties?.spec
      ? processProperties(schema.openAPIV3Schema.properties.spec.properties)
      : {};

    this.data.push({
      title: 'Resource Spec',
      properties: processedSpec,
      type: 'object',
    });

    return this;
  }

  /**
   * Add Crossplane-specific parameters
   */
  addCrossplaneParameters(options: {
    compositions?: string[];
    defaultComposition?: string;
  } = {}): this {
    const properties: Record<string, any> = {
      writeConnectionSecretToRef: {
        title: 'Crossplane Configuration Details',
        properties: {
          name: {
            title: 'Connection Secret Name',
            type: 'string',
          },
        },
        type: 'object',
      },
      compositeDeletePolicy: {
        title: 'Composite Delete Policy',
        default: 'Background',
        enum: ['Background', 'Foreground'],
        type: 'string',
      },
      compositionUpdatePolicy: {
        title: 'Composition Update Policy',
        enum: ['Automatic', 'Manual'],
        type: 'string',
      },
      compositionSelectionStrategy: {
        title: 'Composition Selection Strategy',
        description: 'How the composition should be selected.',
        enum: ['runtime', ...(options.compositions?.length ? ['direct-reference'] : []), 'label-selector'],
        default: 'runtime',
        type: 'string',
      },
    };

    const dependencies = this.buildCompositionDependencies(options.compositions, options.defaultComposition);

    this.data.push({
      title: 'Crossplane Settings',
      properties,
      dependencies,
      type: 'object',
    });

    return this;
  }

  /**
   * Add GitOps publish parameters
   */
  addPublishParameters(options: {
    clusters: string[];
    allowRepoSelection?: boolean;
    repoUrl?: string;
    targetBranch?: string;
    allowedHosts?: string[];
  }): this {
    const baseProperties: any = {
      pushToGit: {
        title: 'Push Manifest to GitOps Repository',
        type: 'boolean',
        default: true,
      },
    };

    const gitProperties: any = {
      pushToGit: { enum: [true] },
      manifestLayout: {
        type: 'string',
        description: 'Layout of the manifest',
        default: 'cluster-scoped',
        'ui:help': 'Choose how the manifest should be generated in the repo.',
        enum: ['cluster-scoped', 'namespace-scoped', 'custom'],
      },
    };

    if (options.allowRepoSelection) {
      gitProperties.repoUrl = {
        type: 'string',
        description: 'Name of repository',
        'ui:field': 'RepoUrlPicker',
        'ui:options': {
          allowedHosts: options.allowedHosts || [],
        },
      };
      gitProperties.targetBranch = {
        type: 'string',
        description: 'Target Branch for the PR',
        default: options.targetBranch || 'main',
      };
    }

    const dependencies = this.buildManifestLayoutDependencies(options.clusters);

    this.data.push({
      title: 'Creation Settings',
      properties: baseProperties,
      dependencies: {
        pushToGit: {
          oneOf: [
            {
              properties: {
                pushToGit: { enum: [false] },
              },
            },
            {
              properties: gitProperties,
              dependencies,
            },
          ],
        },
      },
      type: 'object',
    });

    return this;
  }

  /**
   * Add a custom parameter group
   */
  addCustomParameterGroup(parameter: Parameter): this {
    this.data.push(parameter);
    return this;
  }

  private buildCompositionDependencies(compositions?: string[], defaultComposition?: string): any {
    const dependencies: any[] = [
      {
        properties: {
          compositionSelectionStrategy: { enum: ['runtime'] },
        },
      },
    ];

    if (compositions?.length) {
      dependencies.push({
        properties: {
          compositionSelectionStrategy: { enum: ['direct-reference'] },
          compositionRef: {
            title: 'Composition Reference',
            properties: {
              name: {
                type: 'string',
                title: 'Select A Composition By Name',
                enum: compositions,
                ...(defaultComposition && { default: defaultComposition }),
              },
            },
            required: ['name'],
            type: 'object',
          },
        },
      });
    }

    dependencies.push({
      properties: {
        compositionSelectionStrategy: { enum: ['label-selector'] },
        compositionSelector: {
          title: 'Composition Selector',
          properties: {
            matchLabels: {
              title: 'Match Labels',
              additionalProperties: { type: 'string' },
              type: 'object',
            },
          },
          required: ['matchLabels'],
          type: 'object',
        },
      },
    });

    return {
      compositionSelectionStrategy: {
        oneOf: dependencies,
      },
    };
  }

  private buildManifestLayoutDependencies(clusters: string[]): any {
    return {
      manifestLayout: {
        oneOf: [
          {
            properties: {
              manifestLayout: { enum: ['cluster-scoped'] },
              clusters: {
                title: 'Target Clusters',
                description: 'The target clusters to apply the resource to',
                type: 'array',
                minItems: 1,
                items: {
                  enum: clusters,
                  type: 'string',
                },
                uniqueItems: true,
                'ui:widget': 'checkboxes',
              },
            },
            required: ['clusters'],
          },
          {
            properties: {
              manifestLayout: { enum: ['custom'] },
              basePath: {
                type: 'string',
                description: 'Base path in GitOps repository',
              },
            },
            required: ['basePath'],
          },
          {
            properties: {
              manifestLayout: { enum: ['namespace-scoped'] },
            },
          },
        ],
      },
    };
  }
}