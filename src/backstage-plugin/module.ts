import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import {
  catalogProcessingExtensionPoint,
} from '@backstage/plugin-catalog-node/alpha';
import { KubernetesEntityProvider, XRDTemplateEntityProvider } from './entity-providers';
import { DefaultKubernetesResourceFetcher } from './services';

export const catalogModuleIngestor = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'ingestor',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        discovery: coreServices.discovery,
        scheduler: coreServices.scheduler,
        auth: coreServices.auth,
      },
      async init({
        catalog,
        logger,
        config,
        discovery,
        scheduler,
        auth,
      }) {
        const taskRunner = scheduler.createScheduledTaskRunner({
          frequency: {
            seconds: config.getOptionalNumber(
              'ingestor.kubernetes.taskRunner.frequency',
            ) ?? 600,
          },
          timeout: {
            seconds: config.getOptionalNumber(
              'ingestor.kubernetes.taskRunner.timeout',
            ) ?? 600,
          },
        });

        const xrdTaskRunner = scheduler.createScheduledTaskRunner({
          frequency: {
            seconds: config.getOptionalNumber(
              'ingestor.crossplane.xrds.taskRunner.frequency',
            ) ?? 600,
          },
          timeout: {
            seconds: config.getOptionalNumber(
              'ingestor.crossplane.xrds.taskRunner.timeout',
            ) ?? 600,
          },
        });

        const resourceFetcher = new DefaultKubernetesResourceFetcher(discovery, auth);

        const templateEntityProvider = new KubernetesEntityProvider(
          taskRunner,
          logger,
          config,
          resourceFetcher,
        );

        const xrdTemplateEntityProvider = new XRDTemplateEntityProvider(
          xrdTaskRunner,
          logger,
          config,
          resourceFetcher,
        );

        const xrdEnabled = config.getOptionalBoolean('ingestor.crossplane.xrds.enabled');
        await catalog.addEntityProvider(templateEntityProvider);
        // Only disable if explicitly set to false; default is enabled
        if (xrdEnabled !== false) {
          await catalog.addEntityProvider(xrdTemplateEntityProvider);
        }
      },
    });
  },
});

export const ingestorPlugin = catalogModuleIngestor;
