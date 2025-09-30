// Export Backstage plugin
export { catalogModuleIngestor as default } from './backstage-plugin/module';
export { catalogModuleIngestor } from './backstage-plugin/module';

// Export entity providers
export {
  KubernetesEntityProvider,
  XRDTemplateEntityProvider
} from './backstage-plugin/entity-providers';

// Export types
export type {
  KubernetesResourceFetcher,
  KubernetesResourceFetcherOptions
} from './types';

// Export xrd-transform for external use
export * from './xrd-transform';
