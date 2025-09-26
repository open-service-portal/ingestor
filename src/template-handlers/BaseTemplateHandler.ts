import { Entity } from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import { ITemplateHandler } from './ITemplateHandler';
import { TemplateEntityBuilder, ParametersBuilder } from '../entity-builders';
import { CrossplaneVersionHandler } from '../version-handlers';

/**
 * Abstract base class for template handlers
 * Contains shared logic between v1 and v2 handlers
 */
export abstract class BaseTemplateHandler implements ITemplateHandler {
  constructor(protected readonly config: Config) {}

  abstract generateTemplates(xrd: any, version: any, clusters: string[]): Entity;
  abstract extractParameters(version: any, clusters: string[], xrd: any): any[];
  abstract extractSteps(version: any, xrd: any): any[];
  abstract getHandlerType(): string;
  abstract canHandle(xrd: any): boolean;

  /**
   * Get the annotation prefix from config
   */
  protected getAnnotationPrefix(): string {
    return this.config.getOptionalString('kubernetesIngestor.annotationPrefix') || 'terasky.backstage.io';
  }

  /**
   * Get allowed hosts for repository selection
   */
  protected getAllowedHosts(): string[] {
    const publishPhaseTarget = this.getPublishPhaseTarget();
    const allowedTargets = this.config.getOptionalStringArray(
      'kubernetesIngestor.crossplane.xrds.publishPhase.allowedTargets'
    );

    if (allowedTargets) {
      return allowedTargets;
    }

    switch (publishPhaseTarget) {
      case 'github':
        return ['github.com'];
      case 'gitlab':
        return ['gitlab.com'];
      case 'bitbucket':
        return ['only-bitbucket-server-is-allowed'];
      case 'bitbucketcloud':
        return ['bitbucket.org'];
      default:
        return [];
    }
  }

  /**
   * Get the publish phase target
   */
  protected getPublishPhaseTarget(): string {
    return this.config.getOptionalString(
      'kubernetesIngestor.crossplane.xrds.publishPhase.target'
    )?.toLowerCase() || 'github';
  }

  /**
   * Get the pull request URL template based on the target
   */
  protected getPullRequestUrl(): string {
    const target = this.getPublishPhaseTarget();
    switch (target) {
      case 'gitlab':
        return '${{ steps["create-pull-request"].output.mergeRequestUrl }}';
      case 'bitbucket':
      case 'bitbucketcloud':
        return '${{ steps["create-pull-request"].output.pullRequestUrl }}';
      case 'github':
      default:
        return '${{ steps["create-pull-request"].output.remoteUrl }}';
    }
  }

  /**
   * Get the publish action based on the target
   */
  protected getPublishAction(): string {
    const target = this.getPublishPhaseTarget();
    switch (target) {
      case 'gitlab':
        return 'publish:gitlab:merge-request';
      case 'bitbucket':
        return 'publish:bitbucketServer:pull-request';
      case 'bitbucketcloud':
        return 'publish:bitbucketCloud:pull-request';
      case 'github':
      default:
        return 'publish:github:pull-request';
    }
  }

  /**
   * Build spec parameters from version schema
   */
  protected buildSpecParameters(version: any): any {
    const builder = new ParametersBuilder();
    const convertDefaultsToPlaceholders = this.config.getOptionalBoolean(
      'kubernetesIngestor.crossplane.xrds.convertDefaultValuesToPlaceholders'
    );

    builder.addSpecParameters(version.schema, {
      convertDefaultsToPlaceholders,
    });

    return builder.build()[0]; // Return the first (spec) parameter group
  }

  /**
   * Build publish parameters
   */
  protected buildPublishParameters(clusters: string[]): any {
    const builder = new ParametersBuilder();
    const allowRepoSelection = this.config.getOptionalBoolean(
      'kubernetesIngestor.crossplane.xrds.publishPhase.allowRepoSelection'
    );
    const repoUrl = this.config.getOptionalString(
      'kubernetesIngestor.crossplane.xrds.publishPhase.git.repoUrl'
    );
    const targetBranch = this.config.getOptionalString(
      'kubernetesIngestor.crossplane.xrds.publishPhase.git.targetBranch'
    ) || 'main';

    builder.addPublishParameters({
      clusters,
      allowRepoSelection,
      repoUrl,
      targetBranch,
      allowedHosts: this.getAllowedHosts(),
    });

    return builder.build()[0]; // Return the publish parameter group
  }

  /**
   * Build template entity with common properties
   */
  protected buildTemplateEntity(
    xrd: any,
    version: any,
    clusters: string[],
    parameters: any[],
    steps: any[]
  ): Entity {
    const builder = new TemplateEntityBuilder();
    const prefix = this.getAnnotationPrefix();
    const clusterTags = clusters.map((cluster: string) => `cluster:${cluster}`);

    return builder
      .withCrossplaneMetadata(xrd.metadata.name, version.name, xrd.clusterName)
      .withType(xrd.metadata.name)
      .withCrossplaneLabels()
      .withTags(['crossplane', ...clusterTags])
      .withAnnotations({
        [`${prefix}/crossplane-version`]: CrossplaneVersionHandler.getVersion(xrd),
        [`${prefix}/crossplane-scope`]: CrossplaneVersionHandler.getScope(xrd),
      })
      .withParameters(parameters)
      .withSteps(steps)
      .withStandardOutputLinks(this.getPullRequestUrl())
      .build();
  }
}