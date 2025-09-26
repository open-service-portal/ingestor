/**
 * Backstage module configuration using the shared ingestion engine
 * This integrates the CLI-compatible engine with Backstage's runtime
 */

import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import {
  catalogProcessingExtensionPoint,
} from '@backstage/plugin-catalog-node/alpha';
import { RuntimeAdapter } from './runtime/adapters/RuntimeAdapter';
import { createIngestionEngine } from './core/engine/IngestionEngine';
import { createResourceValidator } from './core/validators/ResourceValidator';
import { createXRDEntityBuilder } from './core/builders/XRDEntityBuilder';

export const catalogModuleIngestorNew = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'ingestor',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ catalog, logger, config }) {
        // Create the shared ingestion engine with default configuration
        const validator = createResourceValidator();
        const builders = [createXRDEntityBuilder()];
        const engine = createIngestionEngine(validator, builders);

        // Create the runtime adapter that bridges Backstage with the engine
        const adapter = new RuntimeAdapter(engine, logger, config);

        // Register as a catalog processor
        catalog.addProcessor(adapter);

        logger.info('Ingestor module initialized with shared engine');
      },
    });
  },
});