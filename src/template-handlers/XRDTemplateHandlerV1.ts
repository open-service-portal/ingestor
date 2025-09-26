import { Entity } from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import { BaseTemplateHandler } from './BaseTemplateHandler';
import { TemplateEntityBuilder, StepsBuilder, ParametersBuilder } from '../entity-builders';
import { CrossplaneVersionHandler } from '../version-handlers';

/**
 * Handles XRD template generation for Crossplane v1
 */
export class XRDTemplateHandlerV1 extends BaseTemplateHandler {
  constructor(config: Config) {
    super(config);
  }

  canHandle(xrd: any): boolean {
    return !CrossplaneVersionHandler.isV2(xrd);
  }

  getHandlerType(): string {
    return 'v1';
  }

  /**
   * Generates template entities for v1 XRD
   * v1 always uses claims
   */
  generateTemplates(xrd: any, version: any, clusters: string[]): Entity {
    const parameters = this.extractParameters(version, clusters, xrd);
    const steps = this.extractSteps(version, xrd);
    const prefix = this.getAnnotationPrefix();
    const clusterTags = clusters.map((cluster: any) => `cluster:${cluster}`);

    const builder = new TemplateEntityBuilder();

    return builder
      .withCrossplaneMetadata(xrd.metadata.name, version.name, xrd.clusterName)
      .withTitle(`${xrd.spec.claimNames?.kind}`)
      .withType(xrd.metadata.name)
      .withCrossplaneLabels()
      .withTags(['crossplane', 'v1', ...clusterTags])
      .withAnnotations({
        [`${prefix}/crossplane-claim`]: 'true',
        [`${prefix}/crossplane-version`]: 'v1',
        [`${prefix}/crossplane-scope`]: 'Cluster',
      })
      .withParameters(parameters)
      .withSteps(steps)
      .withStandardOutputLinks(this.getPullRequestUrl())
      .build();
  }

  /**
   * Extracts parameters for v1 XRD
   */
  extractParameters(version: any, clusters: string[], xrd: any): any[] {
    const builder = new ParametersBuilder();

    // Add resource metadata (v1 always includes namespace)
    builder.addResourceMetadata({ includeNamespace: true });

    // Add spec parameters
    builder.addSpecParameters(version.schema, {
      convertDefaultsToPlaceholders: this.config.getOptionalBoolean(
        'kubernetesIngestor.crossplane.xrds.convertDefaultValuesToPlaceholders'
      ),
    });

    // Add v1-specific Crossplane parameters
    builder.addCrossplaneParameters({
      compositions: xrd.compositions,
      defaultComposition: xrd.spec?.defaultCompositionRef?.name,
    });

    // Add publish parameters
    builder.addPublishParameters({
      clusters,
      allowRepoSelection: this.config.getOptionalBoolean(
        'kubernetesIngestor.crossplane.xrds.publishPhase.allowRepoSelection'
      ),
      repoUrl: this.config.getOptionalString(
        'kubernetesIngestor.crossplane.xrds.publishPhase.git.repoUrl'
      ),
      targetBranch: this.config.getOptionalString(
        'kubernetesIngestor.crossplane.xrds.publishPhase.git.targetBranch'
      ) || 'main',
      allowedHosts: this.getAllowedHosts(),
    });

    return builder.build();
  }

  /**
   * Extracts steps for v1 XRD
   */
  extractSteps(version: any, xrd: any): any[] {
    const builder = new StepsBuilder();

    // Generate manifest step (v1 always uses claims)
    builder.addGenerateManifestStep({
      nameParam: 'xrName',
      namespaceParam: 'xrNamespace',
      ownerParam: 'owner',
      excludeParams: [
        'crossplane.compositionSelectionStrategy',
        'owner',
        'pushToGit',
        'basePath',
        'manifestLayout',
        '_editData',
        'targetBranch',
        'repoUrl',
        'clusters',
        'xrName',
        'xrNamespace'
      ],
      apiVersion: `${xrd.spec.group}/${version.name}`,
      kind: xrd.spec.claimNames?.kind || xrd.spec.names?.kind,
      clusters: '${{ parameters.clusters if parameters.manifestLayout === \'cluster-scoped\' and parameters.pushToGit else [\'temp\'] }}',
      removeEmptyParams: true,
    });

    // Add namespace-scoped manifest move step
    builder.addMoveNamespacedManifestStep('xrNamespace');

    // Add custom manifest move step
    builder.addMoveCustomManifestStep('xrName');

    // Add create pull request step
    const allowRepoSelection = this.config.getOptionalBoolean(
      'kubernetesIngestor.crossplane.xrds.publishPhase.allowRepoSelection'
    );

    const repoUrl = allowRepoSelection
      ? '${{ parameters.repoUrl }}'
      : this.config.getOptionalString(
          'kubernetesIngestor.crossplane.xrds.publishPhase.git.repoUrl'
        ) || '';

    const targetBranch = allowRepoSelection
      ? '${{ parameters.targetBranch }}'
      : this.config.getOptionalString(
          'kubernetesIngestor.crossplane.xrds.publishPhase.git.targetBranch'
        ) || 'main';

    builder.addCreatePullRequestStep({
      action: this.getPublishAction(),
      repoUrl,
      nameParam: 'xrName',
      targetBranch,
      kind: xrd.spec.claimNames?.kind || xrd.spec.names?.kind,
    });

    return builder.build();
  }

}