import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import { LoggerService, SchedulerServiceTaskRunner } from '@backstage/backend-plugin-api';
import { DefaultKubernetesResourceFetcher } from '../services';
import { XRDDataProvider } from '../data-providers/XRDDataProvider';
import { CRDDataProvider } from '../data-providers/CRDDataProvider';
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
    const templateDirConfig = this.config.getOptionalString('ingestor.crossplane.xrds.templateDir');

    // Resolve relative paths to absolute paths
    // Config paths are relative to the app-portal root, not backend working directory
    let templateDir: string | undefined;
    if (templateDirConfig) {
      const path = require('path');
      // Resolve relative to app-portal root (2 levels up from packages/backend)
      const appRoot = path.resolve(process.cwd(), '../..');
      templateDir = path.resolve(appRoot, templateDirConfig);
      this.logger.info(`XRDTemplateEntityProvider: Resolved template directory: ${templateDir}`);
      this.logger.info(`  Config value: ${templateDirConfig}`);
      this.logger.info(`  App root: ${appRoot}`);
      this.logger.info(`  CWD: ${process.cwd()}`);
    } else {
      this.logger.info(`XRDTemplateEntityProvider: Using default template directory (npm package)`);
    }

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
      const isCrossplaneEnabled = this.config.getOptionalBoolean('ingestor.crossplane.enabled') ?? true;

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
      if (this.config.getOptionalBoolean('ingestor.crossplane.xrds.enabled') !== false) {
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
      if (this.config.getOptionalBoolean('ingestor.crds.enabled') !== false) {
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
        entities: allEntities.map((entityWithMeta: any) => {
          const { _xrdBaseName, ...entity } = entityWithMeta;
          return {
            entity,
            locationKey: `provider:${this.getProviderName()}`,
          };
        }),
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

    // Get GitOps configuration with XRD-level overrides
    // Start with global defaults from app-config
    let gitopsConfig = {
      owner: this.config.getOptionalString('ingestor.crossplane.xrds.gitops.owner'),
      repo: this.config.getOptionalString('ingestor.crossplane.xrds.gitops.repo'),
      targetBranch: this.config.getOptionalString('ingestor.crossplane.xrds.gitops.targetBranch'),
    };

    // Check for XRD-level parameter defaults via annotations
    // Pattern: openportal.dev/parameter.<paramName>: <value>
    const annotations = xrd.metadata?.annotations || {};
    const parameterDefaults: Record<string, string> = {};

    for (const [key, value] of Object.entries(annotations)) {
      if (key.startsWith('openportal.dev/parameter.')) {
        const paramName = key.replace('openportal.dev/parameter.', '');
        parameterDefaults[paramName] = value as string;
      }
    }

    // Apply parameter defaults to GitOps config (XRD annotations take precedence)
    if (parameterDefaults.gitopsOwner) {
      gitopsConfig.owner = parameterDefaults.gitopsOwner;
    }
    if (parameterDefaults.gitopsRepo) {
      gitopsConfig.repo = parameterDefaults.gitopsRepo;
    }
    if (parameterDefaults.gitopsTargetBranch) {
      gitopsConfig.targetBranch = parameterDefaults.gitopsTargetBranch;
    }

    if (Object.keys(parameterDefaults).length > 0) {
      this.logger.debug(`Using XRD parameter defaults for ${xrd.metadata?.name}: ${JSON.stringify(parameterDefaults)}`);
    }

    // Debug: Log config for gitops templates
    const stepsTemplate = xrd.metadata?.annotations?.['openportal.dev/template-steps'];
    if (stepsTemplate?.includes('gitops')) {
      this.logger.debug(`GitOps config for ${xrd.metadata?.name}: ${JSON.stringify(gitopsConfig, null, 2)}`);
    }

    // Transform using xrd-transform
    const result = await this.transformer.transform(extractData, {
      context: {
        owner,
        tags,
        config: {
          gitops: gitopsConfig
        },
      },
    });

    // Debug: Log generated template entities
    if (result.success && result.entities && result.entities.length > 0) {
      for (const entity of result.entities) {
        this.logger.info(`Generated entity for ${xrd.metadata?.name}:`);
        this.logger.info(`  Kind: ${entity.kind}`);
        this.logger.info(`  Name: ${entity.metadata?.name}`);
        this.logger.info(`  Labels: ${JSON.stringify(entity.metadata?.labels || null)}`);

        // Log scaffolder steps for Template entities
        if (entity.kind === 'Template' && entity.spec?.steps) {
          this.logger.debug(`  Steps:`);
          for (const step of entity.spec.steps) {
            this.logger.debug(`    - ${step.id}: ${step.action}`);
            if (step.action === 'publish:github:pull-request') {
              this.logger.debug(`      repoUrl: ${step.input?.repoUrl}`);
              this.logger.debug(`      targetBranchName: ${step.input?.targetBranchName}`);
            }
          }
        }
      }
    }

    if (!result.success) {
      throw new Error(`Transform failed: ${result.errors?.join(', ')}`);
    }

    return result.entities as Entity[];
  }
}
