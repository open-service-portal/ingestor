/**
 * Runtime Adapter - bridges Backstage backend with core engine
 * Handles Kubernetes API access, logging, and entity publishing
 */

import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import * as k8s from '@kubernetes/client-node';
import {
  IIngestionEngine,
  Resource,
  IngestionConfig,
} from '../../core/engine/interfaces';

export class RuntimeAdapter implements CatalogProcessor {
  private readonly engine: IIngestionEngine;
  private readonly logger: LoggerService;
  private readonly k8sApi: k8s.CustomObjectsApi;
  private readonly config: Config;

  constructor(
    engine: IIngestionEngine,
    logger: LoggerService,
    config: Config
  ) {
    this.engine = engine;
    this.logger = logger;
    this.config = config;

    // Initialize Kubernetes client
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.k8sApi = kc.makeApiClient(k8s.CustomObjectsApi);
  }

  /**
   * Get processor name
   */
  getProcessorName(): string {
    return 'IngestorProcessor';
  }

  /**
   * Process entities - main entry point for Backstage
   */
  async postProcessEntity(
    entity: Entity,
    _location: any,
    emit: CatalogProcessorEmit
  ): Promise<Entity> {
    // Only process if this is a trigger entity
    if (entity.metadata.annotations?.['ingestor.backstage.io/enabled'] === 'true') {
      this.logger.info('Starting resource ingestion');

      try {
        // Discover resources from Kubernetes
        const resources = await this.discoverResources();
        this.logger.info(`Discovered ${resources.length} resources`);

        // Build configuration from entity annotations
        const config: IngestionConfig = {
          validation: {
            strict: entity.metadata.annotations?.['ingestor.backstage.io/strict'] === 'true',
          },
          building: {
            owner: entity.metadata.annotations?.['ingestor.backstage.io/owner'],
            namespace: entity.metadata.annotations?.['ingestor.backstage.io/namespace'],
            tags: entity.metadata.annotations?.['ingestor.backstage.io/tags']?.split(','),
          },
        };

        // Ingest using shared engine
        const entities = await this.engine.ingest(resources, config);
        this.logger.info(`Generated ${entities.length} entities`);

        // Emit entities to catalog
        for (const generatedEntity of entities) {
          emit(processingResult.entity(generatedEntity));
        }
      } catch (error) {
        this.logger.error('Ingestion failed', error as Error);
      }
    }

    return entity;
  }

  /**
   * Discover resources from Kubernetes cluster
   */
  private async discoverResources(): Promise<Resource[]> {
    const resources: Resource[] = [];

    try {
      // Discover XRDs
      const xrds = await this.discoverXRDs();
      resources.push(...xrds);

      // Discover other resources based on config
      const resourceTypes = this.config.getOptionalStringArray(
        'ingestor.resourceTypes'
      ) || ['CompositeResourceDefinition'];

      for (const resourceType of resourceTypes) {
        if (resourceType === 'CompositeResourceDefinition') {
          continue; // Already handled
        }

        const discovered = await this.discoverResourceType(resourceType);
        resources.push(...discovered);
      }
    } catch (error) {
      this.logger.error('Resource discovery failed', error as Error);
    }

    return resources;
  }

  /**
   * Discover Crossplane XRDs
   */
  private async discoverXRDs(): Promise<Resource[]> {
    const resources: Resource[] = [];

    try {
      const response = await this.k8sApi.listClusterCustomObject(
        'apiextensions.crossplane.io',
        'v1',
        'compositeresourcedefinitions'
      );

      const items = (response.body as any).items || [];
      for (const item of items) {
        resources.push(item as Resource);
      }
    } catch (error) {
      this.logger.warn('Failed to discover XRDs', error as Error);
    }

    return resources;
  }

  /**
   * Discover a specific resource type
   */
  private async discoverResourceType(kind: string): Promise<Resource[]> {
    const resources: Resource[] = [];

    // Map kinds to API groups and versions
    const kindMapping: Record<string, { group: string; version: string; resource: string }> = {
      'Deployment': { group: 'apps', version: 'v1', resource: 'deployments' },
      'Service': { group: '', version: 'v1', resource: 'services' },
      'StatefulSet': { group: 'apps', version: 'v1', resource: 'statefulsets' },
      'ConfigMap': { group: '', version: 'v1', resource: 'configmaps' },
    };

    const mapping = kindMapping[kind];
    if (!mapping) {
      this.logger.warn(`Unknown resource kind: ${kind}`);
      return resources;
    }

    try {
      // List resources from all namespaces
      const response = await this.k8sApi.listClusterCustomObject(
        mapping.group,
        mapping.version,
        mapping.resource
      );

      const items = (response.body as any).items || [];
      for (const item of items) {
        resources.push(item as Resource);
      }
    } catch (error) {
      this.logger.warn(`Failed to discover ${kind} resources`, error as Error);
    }

    return resources;
  }
}