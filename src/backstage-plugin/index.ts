/**
 * Backstage Ingestor Plugin
 * Main entry point for the Backstage plugin
 */

// Export the backend module
export { ingestorPlugin as default } from './module';

// Export entity providers for catalog integration
export * from './entity-providers';

// Export types
export type {
  IngestorConfig,
  KubernetesClusterConfig,
  ResourceFilter,
} from './types';