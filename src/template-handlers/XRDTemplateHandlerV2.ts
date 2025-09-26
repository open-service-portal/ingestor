import { Entity } from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import { BaseTemplateHandler } from './BaseTemplateHandler';
import { TemplateEntityBuilder, StepsBuilder, ParametersBuilder } from '../entity-builders';
import { CrossplaneVersionHandler } from '../version-handlers/CrossplaneVersionHandler';

/**
 * Handles XRD template generation for Crossplane v2
 */
export class XRDTemplateHandlerV2 extends BaseTemplateHandler {
  constructor(config: Config) {
    super(config);
  }

  canHandle(xrd: any): boolean {
    return CrossplaneVersionHandler.isV2(xrd);
  }

  getHandlerType(): string {
    return 'v2';
  }

  /**
   * Generates template entities for v2 XRD
   * v2 supports LegacyCluster (uses claims), Cluster (direct XR), and Namespaced (direct XR)
   */
  generateTemplates(xrd: any, version: any, clusters: string[]): Entity {
    const parameters = this.extractParameters(version, clusters, xrd);
    const steps = this.extractSteps(version, xrd);
    const prefix = this.getAnnotationPrefix();
    const clusterTags = clusters.map((cluster: any) => `cluster:${cluster}`);
    const scope = CrossplaneVersionHandler.getScope(xrd);
    const isLegacyCluster = CrossplaneVersionHandler.isLegacyCluster(xrd);
    const isDirectXR = CrossplaneVersionHandler.isDirectXR(xrd);

    const builder = new TemplateEntityBuilder();

    // Determine the title based on scope and whether claims are used
    let title: string;
    if (isLegacyCluster) {
      title = `${xrd.spec.claimNames?.kind}`;
    } else {
      title = `${xrd.spec.names?.kind}`;
    }

    return builder
      .withCrossplaneMetadata(xrd.metadata.name, version.name, xrd.clusterName)
      .withTitle(title)
      .withType(xrd.metadata.name)
      .withCrossplaneLabels()
      .withTags(['crossplane', 'v2', ...clusterTags])
      .withAnnotations({
        [`${prefix}/crossplane-claim`]: isLegacyCluster ? 'true' : 'false',
        [`${prefix}/crossplane-version`]: 'v2',
        [`${prefix}/crossplane-scope`]: scope,
        [`${prefix}/crossplane-direct-xr`]: isDirectXR ? 'true' : 'false',
      })
      .withParameters(parameters)
      .withSteps(steps)
      .withStandardOutputLinks(this.getPullRequestUrl())
      .build();
  }

  /**
   * Extracts parameters for v2 XRD based on scope
   */
  extractParameters(version: any, clusters: string[], xrd: any): any[] {
    const isLegacyCluster = CrossplaneVersionHandler.isLegacyCluster(xrd);
    const includeNamespace = CrossplaneVersionHandler.shouldIncludeNamespace(xrd);
    const builder = new ParametersBuilder();

    // Add resource metadata (namespace inclusion depends on scope)
    builder.addResourceMetadata({ includeNamespace });

    // Add spec parameters
    builder.addSpecParameters(version.schema, {
      convertDefaultsToPlaceholders: this.config.getOptionalBoolean(
        'kubernetesIngestor.crossplane.xrds.convertDefaultValuesToPlaceholders'
      ),
    });

    // Add v2-specific Crossplane parameters (minimal for direct XRs, full for legacy cluster)
    if (isLegacyCluster) {
      builder.addCrossplaneParameters({
        compositions: xrd.compositions,
        defaultComposition: xrd.spec?.defaultCompositionRef?.name,
      });
    } else {
      // For direct XRs, only add composition selection
      builder.addCustomParameterGroup({
        title: 'Crossplane Settings',
        properties: {
          compositionSelectionStrategy: {
            title: 'Composition Selection Strategy',
            description: 'How the composition should be selected.',
            enum: ['runtime', ...(xrd.compositions?.length ? ['direct-reference'] : []), 'label-selector'],
            default: 'runtime',
            type: 'string',
          },
        },
        dependencies: this.buildCompositionDependencies(xrd.compositions, xrd.spec?.defaultCompositionRef?.name),
        type: 'object',
      });
    }

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
   * Extracts steps for v2 XRD
   */
  extractSteps(version: any, xrd: any): any[] {
    const isDirectXR = CrossplaneVersionHandler.isDirectXR(xrd);
    const includeNamespace = CrossplaneVersionHandler.shouldIncludeNamespace(xrd);

    const builder = new StepsBuilder();

    // Generate manifest step
    const excludeParams = [
      'crossplane.compositionSelectionStrategy',
      'owner',
      'pushToGit',
      'basePath',
      'manifestLayout',
      '_editData',
      'targetBranch',
      'repoUrl',
      'clusters',
      'xrName'
    ];

    if (includeNamespace) {
      excludeParams.push('xrNamespace');
    }

    let kind: string;
    if (isDirectXR) {
      kind = xrd.spec.names?.kind;
    } else {
      kind = xrd.spec.claimNames?.kind || xrd.spec.names?.kind;
    }

    builder.addGenerateManifestStep({
      nameParam: 'xrName',
      namespaceParam: includeNamespace ? 'xrNamespace' : undefined,
      ownerParam: 'owner',
      excludeParams,
      apiVersion: `${xrd.spec.group}/${version.name}`,
      kind,
      clusters: '${{ parameters.clusters if parameters.manifestLayout === \'cluster-scoped\' and parameters.pushToGit else [\'temp\'] }}',
      removeEmptyParams: true,
    });

    // Add namespace-scoped manifest move step (if applicable)
    if (includeNamespace) {
      builder.addMoveNamespacedManifestStep('xrNamespace');
    }

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
      kind,
    });

    return builder.build();
  }

  /**
   * Helper method to build composition dependencies
   */
  private buildCompositionDependencies(compositions?: string[], defaultComposition?: string): any {
    const dependencies: any[] = [
      {
        properties: {
          compositionSelectionStrategy: { enum: ['runtime'] },
        },
      },
    ];

    if (compositions?.length) {
      dependencies.push({
        properties: {
          compositionSelectionStrategy: { enum: ['direct-reference'] },
          compositionRef: {
            title: 'Composition Reference',
            properties: {
              name: {
                type: 'string',
                title: 'Select A Composition By Name',
                enum: compositions,
                ...(defaultComposition && { default: defaultComposition }),
              },
            },
            required: ['name'],
            type: 'object',
          },
        },
      });
    }

    dependencies.push({
      properties: {
        compositionSelectionStrategy: { enum: ['label-selector'] },
        compositionSelector: {
          title: 'Composition Selector',
          properties: {
            matchLabels: {
              title: 'Match Labels',
              additionalProperties: { type: 'string' },
              type: 'object',
            },
          },
          required: ['matchLabels'],
          type: 'object',
        },
      },
    });

    return {
      compositionSelectionStrategy: {
        oneOf: dependencies,
      },
    };
  }

}