import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import { LoggerService, SchedulerServiceTaskRunner } from '@backstage/backend-plugin-api';
import { DefaultKubernetesResourceFetcher } from '../services';
import { XRDDataProvider } from '../providers/XRDDataProvider';
import { CRDDataProvider } from '../providers/CRDDataProvider';
import { XRDTransformer } from '../../xrd-transform/lib/transform';
import { XRDExtractData } from '../../xrd-transform/lib/types';

/**
 * Entity Provider that discovers Crossplane XRDs and CRDs from Kubernetes clusters
 * and transforms them into Backstage Template and API entities using xrd-transform.
 */
export class XRDTemplateEntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;
  private readonly transformer: XRDTransformer;

  constructor(
    private readonly taskRunner: SchedulerServiceTaskRunner,
    private readonly logger: LoggerService,
    private readonly config: Config,
    private readonly resourceFetcher: DefaultKubernetesResourceFetcher,
  ) {
    // Initialize transformer with optional custom template directory
    const templateDir = this.config.getOptionalString('kubernetesIngestor.transform.templateDir');
    this.transformer = new XRDTransformer(templateDir ? { templateDir } : undefined);
  }

  private validateEntityName(entity: Entity): boolean {
    if (entity.metadata.name.length > 63) {
      this.logger.warn(
        `Entity ${entity.metadata.name} of type ${entity.kind} has a name over 63 characters and will be skipped`
      );
      return false;
    }
    return true;
  }

  getProviderName(): string {
    return 'XRDTemplateEntityProvider';
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    await this.taskRunner.run({
      id: this.getProviderName(),
      fn: async () => {
        await this.run();
      },
    });
  }

  async run(): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const isCrossplaneEnabled = this.config.getOptionalBoolean('kubernetesIngestor.crossplane.enabled') ?? true;

      if (!isCrossplaneEnabled) {
        await this.connection.applyMutation({
          type: 'full',
          entities: [],
        });
        return;
      }

      this.logger.info('Starting XRD and CRD discovery...');

      const allEntities: Entity[] = [];

      // Fetch XRDs if enabled
      if (this.config.getOptionalBoolean('kubernetesIngestor.crossplane.xrds.enabled') !== false) {
        const xrdDataProvider = new XRDDataProvider(
          this.resourceFetcher,
          this.config,
          this.logger,
        );

        const xrds = await xrdDataProvider.fetchXRDObjects();
        this.logger.info(`Discovered ${xrds.length} XRDs`);

        // Transform each XRD using xrd-transform
        for (const xrd of xrds) {
          try {
            const entities = await this.transformXRD(xrd);
            allEntities.push(...entities.filter(e => this.validateEntityName(e)));
          } catch (error) {
            this.logger.error(`Failed to transform XRD ${xrd?.metadata?.name}: ${error}`);
          }
        }
      }

      // Fetch CRDs if enabled
      if (this.config.getOptionalBoolean('kubernetesIngestor.crds.enabled') !== false) {
        const crdDataProvider = new CRDDataProvider(
          this.resourceFetcher,
          this.config,
          this.logger,
        );

        const crds = await crdDataProvider.fetchCRDObjects();
        this.logger.info(`Discovered ${crds.length} CRDs`);

        // Transform each CRD using xrd-transform
        for (const crd of crds) {
          try {
            const entities = await this.transformXRD(crd);
            allEntities.push(...entities.filter(e => this.validateEntityName(e)));
          } catch (error) {
            this.logger.error(`Failed to transform CRD ${crd?.metadata?.name}: ${error}`);
          }
        }
      }

      this.logger.info(`Generated ${allEntities.length} entities total`);

      // Apply mutation to catalog
      await this.connection.applyMutation({
        type: 'full',
        entities: allEntities.map(entity => ({
          entity,
          locationKey: `provider:${this.getProviderName()}`,
        })),
      });
    } catch (error) {
      this.logger.error(`Failed to run XRDTemplateEntityProvider: ${error}`);
    }
  }

  /**
   * Transform an XRD or CRD into Backstage entities using xrd-transform
   */
  private async transformXRD(xrd: any): Promise<Entity[]> {
    if (!xrd?.metadata || !xrd?.spec) {
      this.logger.warn(`Skipping resource ${xrd?.metadata?.name || 'unknown'} due to missing metadata or spec`);
      return [];
    }

    // Prepare extract data
    const extractData: XRDExtractData = {
      source: xrd.clusters?.[0] ? `kubernetes:${xrd.clusters[0]}` : 'kubernetes',
      timestamp: new Date().toISOString(),
      xrd,
      metadata: {
        cluster: xrd.clusters?.[0],
        namespace: xrd.metadata.namespace,
      },
    };

    // Get configuration options
    const owner = this.config.getOptionalString('catalog.owner') || 'platform-team';
    const tags = this.config.getOptionalStringArray('catalog.tags') || [];

    // Transform using xrd-transform
    const result = await this.transformer.transform(extractData, {
      context: {
        owner,
        tags,
      },
    });

    if (!result.success) {
      throw new Error(`Transform failed: ${result.errors?.join(', ')}`);
    }

    return result.entities as Entity[];
  }
}
