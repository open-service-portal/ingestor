/**
 * Core interfaces for the ingestion engine
 * These interfaces are shared between CLI and runtime implementations
 */

import { Entity } from '@backstage/catalog-model';

/**
 * Represents a Kubernetes resource to be ingested
 */
export interface Resource {
  apiVersion: string;
  kind: string;
  metadata: ResourceMetadata;
  spec?: any;
  status?: any;
}

/**
 * Resource metadata
 */
export interface ResourceMetadata {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uid?: string;
  resourceVersion?: string;
}

/**
 * Crossplane XRD resource
 */
export interface XRD extends Resource {
  kind: 'CompositeResourceDefinition';
  spec: {
    group: string;
    names: {
      kind: string;
      plural: string;
      singular?: string;
      categories?: string[];
    };
    claimNames?: {
      kind: string;
      plural: string;
    };
    versions: Array<{
      name: string;
      served: boolean;
      referenceable?: boolean;
      schema?: {
        openAPIV3Schema: any;
      };
    }>;
    connectionSecretKeys?: string[];
  };
}

/**
 * Configuration for resource discovery
 */
export interface DiscoveryConfig {
  source: 'file' | 'directory' | 'cluster';
  path?: string;
  namespace?: string;
  includeNamespaces?: string[];
  excludeNamespaces?: string[];
  resourceTypes?: string[];
}

/**
 * Interface for resource discovery implementations
 */
export interface IResourceDiscovery {
  /**
   * Discover resources from the configured source
   */
  discover(config: DiscoveryConfig): Promise<Resource[]>;
}

/**
 * Validation result for a resource
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error';
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}

/**
 * Interface for resource validation
 */
export interface IResourceValidator {
  /**
   * Validate a resource for ingestion
   */
  validate(resource: Resource): Promise<ValidationResult>;
}

/**
 * Interface for entity builders
 */
export interface IEntityBuilder {
  /**
   * Check if this builder can handle the resource
   */
  canBuild(resource: Resource): boolean;

  /**
   * Build Backstage entities from the resource
   */
  build(resource: Resource, config?: EntityBuilderConfig): Promise<Entity[]>;
}

/**
 * Configuration for entity building
 */
export interface EntityBuilderConfig {
  owner?: string;
  namespace?: string;
  tags?: string[];
  additionalMetadata?: Record<string, any>;
}

/**
 * Interface for entity post-processing
 */
export interface IEntityProcessor {
  /**
   * Process entities after building
   */
  process(entities: Entity[], config?: ProcessorConfig): Promise<Entity[]>;
}

/**
 * Configuration for entity processing
 */
export interface ProcessorConfig {
  addTags?: string[];
  setOwner?: string;
  namespace?: string;
}

/**
 * Main ingestion engine interface
 */
export interface IIngestionEngine {
  /**
   * Ingest resources and produce Backstage entities
   */
  ingest(resources: Resource[], config?: IngestionConfig): Promise<Entity[]>;

  /**
   * Validate resources without ingesting
   */
  validate(resources: Resource[]): Promise<Map<Resource, ValidationResult>>;

  /**
   * Preview what entities would be generated
   */
  preview(resources: Resource[]): Promise<IngestionPreview>;
}

/**
 * Configuration for the ingestion process
 */
export interface IngestionConfig {
  validation?: {
    strict: boolean;
    skipWarnings?: boolean;
  };
  building?: EntityBuilderConfig;
  processing?: ProcessorConfig;
}

/**
 * Preview information for ingestion
 */
export interface IngestionPreview {
  totalResources: number;
  validResources: number;
  invalidResources: number;
  entityCounts: Map<string, number>;
  samples: Entity[];
  errors: Array<{
    resource: string;
    errors: ValidationError[];
  }>;
}