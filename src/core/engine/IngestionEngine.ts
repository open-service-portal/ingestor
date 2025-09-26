/**
 * Core ingestion engine implementation
 * This is the shared logic used by both CLI and runtime
 */

import { Entity } from '@backstage/catalog-model';
import {
  IIngestionEngine,
  IResourceDiscovery,
  IResourceValidator,
  IEntityBuilder,
  IEntityProcessor,
  Resource,
  ValidationResult,
  IngestionConfig,
  IngestionPreview,
  EntityBuilderConfig,
  ProcessorConfig,
} from './interfaces';

export class IngestionEngine implements IIngestionEngine {
  private readonly builders: Map<string, IEntityBuilder>;

  constructor(
    private readonly validator: IResourceValidator,
    builders: IEntityBuilder[],
    private readonly processors: IEntityProcessor[] = []
  ) {
    this.builders = new Map();

    // Register builders by resource kind
    for (const builder of builders) {
      // We'll need to determine which kinds each builder supports
      // For now, we'll use a simple registration pattern
      this.registerBuilder(builder);
    }
  }

  /**
   * Main ingestion method - processes resources into entities
   */
  async ingest(
    resources: Resource[],
    config?: IngestionConfig
  ): Promise<Entity[]> {
    const entities: Entity[] = [];

    // Validate resources if not skipping
    if (config?.validation?.strict !== false) {
      const validationResults = await this.validate(resources);

      // Filter out invalid resources in strict mode
      const validResources = resources.filter(resource => {
        const result = validationResults.get(resource);
        if (!result?.valid && config?.validation?.strict) {
          console.error(`Skipping invalid resource: ${resource.metadata.name}`);
          return false;
        }
        return true;
      });

      resources = validResources;
    }

    // Build entities from each resource
    for (const resource of resources) {
      const builder = this.findBuilder(resource);

      if (!builder) {
        console.warn(`No builder found for resource kind: ${resource.kind}`);
        continue;
      }

      try {
        const resourceEntities = await builder.build(
          resource,
          config?.building
        );
        entities.push(...resourceEntities);
      } catch (error) {
        console.error(
          `Failed to build entities from resource ${resource.metadata.name}:`,
          error
        );
        if (config?.validation?.strict) {
          throw error;
        }
      }
    }

    // Apply post-processing
    let processedEntities = entities;
    for (const processor of this.processors) {
      processedEntities = await processor.process(
        processedEntities,
        config?.processing
      );
    }

    return processedEntities;
  }

  /**
   * Validate resources without ingesting
   */
  async validate(
    resources: Resource[]
  ): Promise<Map<Resource, ValidationResult>> {
    const results = new Map<Resource, ValidationResult>();

    for (const resource of resources) {
      const result = await this.validator.validate(resource);
      results.set(resource, result);
    }

    return results;
  }

  /**
   * Preview what entities would be generated
   */
  async preview(resources: Resource[]): Promise<IngestionPreview> {
    const validationResults = await this.validate(resources);

    const validResources = resources.filter(
      resource => validationResults.get(resource)?.valid
    );

    const invalidResources = resources.filter(
      resource => !validationResults.get(resource)?.valid
    );

    // Count entities by type
    const entityCounts = new Map<string, number>();
    const samples: Entity[] = [];

    // Generate sample entities (first 5 valid resources)
    const sampleResources = validResources.slice(0, 5);
    for (const resource of sampleResources) {
      const builder = this.findBuilder(resource);
      if (builder) {
        try {
          const entities = await builder.build(resource);
          samples.push(...entities);

          // Count entity types
          for (const entity of entities) {
            const count = entityCounts.get(entity.kind) || 0;
            entityCounts.set(entity.kind, count + 1);
          }
        } catch (error) {
          // Ignore errors in preview mode
        }
      }
    }

    // Extrapolate counts for all valid resources
    if (sampleResources.length > 0) {
      const multiplier = validResources.length / sampleResources.length;
      for (const [kind, count] of entityCounts) {
        entityCounts.set(kind, Math.round(count * multiplier));
      }
    }

    // Collect errors
    const errors = invalidResources.map(resource => ({
      resource: `${resource.kind}/${resource.metadata.name}`,
      errors: validationResults.get(resource)?.errors || [],
    }));

    return {
      totalResources: resources.length,
      validResources: validResources.length,
      invalidResources: invalidResources.length,
      entityCounts,
      samples: samples.slice(0, 3), // Return only first 3 samples
      errors: errors.slice(0, 10), // Return first 10 errors
    };
  }

  /**
   * Register a builder for specific resource kinds
   */
  private registerBuilder(builder: IEntityBuilder): void {
    // For now, we'll use a simple approach where builders declare their supported kinds
    // In a real implementation, builders would implement a method to declare supported kinds

    // Check common resource kinds
    const commonKinds = [
      'CompositeResourceDefinition',
      'CustomResourceDefinition',
      'Deployment',
      'Service',
      'ConfigMap',
      'StatefulSet',
    ];

    for (const kind of commonKinds) {
      const testResource: Resource = {
        apiVersion: 'test/v1',
        kind,
        metadata: { name: 'test' },
      };

      if (builder.canBuild(testResource)) {
        this.builders.set(kind, builder);
      }
    }
  }

  /**
   * Find a builder for a resource
   */
  private findBuilder(resource: Resource): IEntityBuilder | undefined {
    // First try exact match by kind
    const builder = this.builders.get(resource.kind);
    if (builder) {
      return builder;
    }

    // Then try to find any builder that can handle it
    for (const [, candidateBuilder] of this.builders) {
      if (candidateBuilder.canBuild(resource)) {
        // Cache for future use
        this.builders.set(resource.kind, candidateBuilder);
        return candidateBuilder;
      }
    }

    return undefined;
  }
}

/**
 * Factory function to create an ingestion engine with default configuration
 */
export function createIngestionEngine(
  validator: IResourceValidator,
  builders: IEntityBuilder[],
  processors?: IEntityProcessor[]
): IIngestionEngine {
  return new IngestionEngine(validator, builders, processors);
}