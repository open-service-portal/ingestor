import yaml from 'js-yaml';
import { CrossplaneVersionHandler } from '../version-handlers/CrossplaneVersionHandler';
import { CRDScopeHandler } from '../version-handlers/CRDScopeHandler';
import { Config } from '@backstage/config';

/**
 * Builds YAML steps for scaffolder templates
 */
export class StepsYamlBuilder {
  constructor(private readonly config: Config) {}

  /**
   * Builds steps for XRD templates
   */
  buildXRDSteps(version: any, xrd: any): any[] {
    const baseStepsYaml = this.buildXRDBaseSteps(version, xrd);
    const publishStepsYaml = this.buildPublishSteps(xrd, 'crossplane.xrds');

    const finalYaml = baseStepsYaml + publishStepsYaml;
    const populatedYaml = this.populateXRDPlaceholders(finalYaml, version, xrd);

    // Parse the main steps
    const defaultSteps = yaml.load(populatedYaml) as any[];

    // Add any additional steps from the version schema
    const additionalStepsYamlString = version.schema?.openAPIV3Schema?.properties?.steps?.default;
    const additionalSteps = additionalStepsYamlString
      ? yaml.load(additionalStepsYamlString) as any[]
      : [];

    return [...defaultSteps, ...additionalSteps];
  }

  /**
   * Builds steps for CRD templates
   */
  buildCRDSteps(version: any, crd: any): any[] {
    const baseStepsYaml = this.buildCRDBaseSteps(version, crd);
    const publishStepsYaml = this.buildPublishSteps(crd, 'genericCRDTemplates');

    const finalYaml = baseStepsYaml + publishStepsYaml;
    return yaml.load(finalYaml) as any[];
  }

  /**
   * Builds base steps for XRD
   */
  private buildXRDBaseSteps(_version: any, xrd: any): string {
    const isDirectXR = CrossplaneVersionHandler.isDirectXR(xrd);
    const isNamespaced = CrossplaneVersionHandler.isNamespaced(xrd);

    let baseSteps = '';

    if (isDirectXR) {
      // v2 Cluster/Namespaced: no claim, use resource template action
      baseSteps = this.buildDirectXRSteps(xrd, isNamespaced);
    } else {
      // v1 or v2 LegacyCluster: use claim template
      baseSteps = this.buildClaimSteps(xrd);
    }

    return baseSteps;
  }

  /**
   * Builds steps for direct XR (v2 Cluster/Namespaced)
   */
  private buildDirectXRSteps(_xrd: any, isNamespaced: boolean): string {
    let steps =
      '- id: generateManifest\n' +
      '  name: Generate Kubernetes Resource Manifest\n' +
      '  action: terasky:claim-template\n' +
      '  input:\n' +
      '    parameters: ${{ parameters }}\n' +
      '    nameParam: xrName\n' +
      (isNamespaced ? '    namespaceParam: xrNamespace\n' : '    namespaceParam: ""\n') +
      '    ownerParam: owner\n' +
      '    excludeParams: [\'crossplane.compositionSelectionStrategy\',\'owner\',\'pushToGit\',\'basePath\',\'manifestLayout\',\'_editData\',\'targetBranch\',\'repoUrl\',\'clusters\',\'xrName\'' +
      (isNamespaced ? ', \'xrNamespace\'' : '') + ']\n' +
      '    apiVersion: {API_VERSION}\n' +
      '    kind: {KIND}\n' +
      '    clusters: ${{ parameters.clusters if parameters.manifestLayout === \'cluster-scoped\' and parameters.pushToGit else [\'temp\'] }}\n' +
      '    removeEmptyParams: true\n';

    if (isNamespaced) {
      steps += this.buildNamespacedManifestStep();
    }

    steps += this.buildCustomManifestStep();

    return steps;
  }

  /**
   * Builds steps for claim-based resources
   */
  private buildClaimSteps(_xrd: any): string {
    return '- id: generateManifest\n' +
      '  name: Generate Kubernetes Resource Manifest\n' +
      '  action: terasky:claim-template\n' +
      '  input:\n' +
      '    parameters: ${{ parameters }}\n' +
      '    nameParam: xrName\n' +
      '    namespaceParam: xrNamespace\n' +
      '    ownerParam: owner\n' +
      '    excludeParams: [\'owner\', \'compositionSelectionStrategy\',\'pushToGit\',\'basePath\',\'manifestLayout\',\'_editData\', \'targetBranch\', \'repoUrl\', \'clusters\', \'xrName\', \'xrNamespace\']\n' +
      '    apiVersion: {API_VERSION}\n' +
      '    kind: {KIND}\n' +
      '    clusters: ${{ parameters.clusters if parameters.manifestLayout === \'cluster-scoped\' and parameters.pushToGit else [\'temp\'] }}\n' +
      '    removeEmptyParams: true\n' +
      this.buildNamespacedManifestStep() +
      this.buildCustomManifestStep();
  }

  /**
   * Builds base steps for CRD
   */
  private buildCRDBaseSteps(version: any, crd: any): string {
    const namespaceParam = CRDScopeHandler.getNamespaceParamYaml(crd);
    const excludeNamespace = CRDScopeHandler.isNamespaced(crd) ? ', \'namespace\'' : '';

    let steps =
      '- id: generateManifest\n' +
      '  name: Generate Kubernetes Resource Manifest\n' +
      '  action: terasky:crd-template\n' +
      '  input:\n' +
      '    parameters: ${{ parameters }}\n' +
      '    nameParam: name\n' +
      namespaceParam +
      '    excludeParams: [\'compositionSelectionStrategy\',\'pushToGit\',\'basePath\',\'manifestLayout\',\'_editData\', \'targetBranch\', \'repoUrl\', \'clusters\', \'name\'' +
      excludeNamespace + ', \'owner\']\n' +
      `    apiVersion: ${crd.spec.group}/${version.name}\n` +
      `    kind: ${crd.spec.names.kind}\n` +
      '    clusters: ${{ parameters.clusters if parameters.manifestLayout === \'cluster-scoped\' and parameters.pushToGit else [\'temp\'] }}\n' +
      '    removeEmptyParams: true\n';

    if (CRDScopeHandler.isNamespaced(crd)) {
      steps += this.buildNamespacedManifestStep('namespace');
    }

    steps += this.buildCustomManifestStep('name');

    return steps;
  }

  /**
   * Builds the namespaced manifest step
   */
  private buildNamespacedManifestStep(namespaceParam: string = 'xrNamespace'): string {
    return '- id: moveNamespacedManifest\n' +
      '  name: Move and Rename Manifest\n' +
      '  if: ${{ parameters.manifestLayout === \'namespace-scoped\' }}\n' +
      '  action: fs:rename\n' +
      '  input:\n' +
      '    files:\n' +
      '      - from: ${{ steps.generateManifest.output.filePaths[0] }}\n' +
      `        to: "./$\{\{ parameters.${namespaceParam} }}/$\{\{ steps.generateManifest.input.kind }}/$\{\{ steps.generateManifest.output.filePaths[0].split('/').pop() }}"\n`;
  }

  /**
   * Builds the custom manifest step
   */
  private buildCustomManifestStep(nameParam: string = 'xrName'): string {
    return '- id: moveCustomManifest\n' +
      '  name: Move and Rename Manifest\n' +
      '  if: ${{ parameters.manifestLayout === \'custom\' }}\n' +
      '  action: fs:rename\n' +
      '  input:\n' +
      '    files:\n' +
      '      - from: ${{ steps.generateManifest.output.filePaths[0] }}\n' +
      `        to: "./$\{\{ parameters.basePath }}/$\{\{ parameters.${nameParam} }}.yaml"`;
  }

  /**
   * Builds publish steps based on configuration
   */
  private buildPublishSteps(resource: any, configPath: string): string {
    const publishPhaseTarget = this.config.getOptionalString(
      `kubernetesIngestor.${configPath}.publishPhase.target`
    )?.toLowerCase();

    if (publishPhaseTarget === 'yaml') {
      return '';
    }

    const action = this.getPublishAction(publishPhaseTarget);
    const allowRepoSelection = this.config.getOptionalBoolean(
      `kubernetesIngestor.${configPath}.publishPhase.allowRepoSelection`
    );

    if (allowRepoSelection) {
      return this.buildRepoSelectionSteps(action, resource);
    } else {
      return this.buildHardcodedRepoSteps(action, resource, configPath);
    }
  }

  /**
   * Gets the publish action based on target
   */
  private getPublishAction(target?: string): string {
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
   * Builds repo selection steps
   */
  private buildRepoSelectionSteps(action: string, resource: any): string {
    const nameParam = resource.metadata ? 'xrName' : 'name';
    return `
- id: create-pull-request
  name: create-pull-request
  action: ${action}
  if: \${{ parameters.pushToGit }}
  input:
    repoUrl: \${{ parameters.repoUrl }}
    branchName: create-\${{ parameters.${nameParam} }}-resource
    title: Create {KIND} Resource \${{ parameters.${nameParam} }}
    description: Create {KIND} Resource \${{ parameters.${nameParam} }}
    targetBranchName: \${{ parameters.targetBranch }}
  `;
  }

  /**
   * Builds hardcoded repo steps
   */
  private buildHardcodedRepoSteps(action: string, resource: any, configPath: string): string {
    const nameParam = resource.metadata ? 'xrName' : 'name';
    const repoUrl = this.config.getOptionalString(`kubernetesIngestor.${configPath}.publishPhase.git.repoUrl`);
    const targetBranch = this.config.getOptionalString(`kubernetesIngestor.${configPath}.publishPhase.git.targetBranch`);

    return `
- id: create-pull-request
  name: create-pull-request
  action: ${action}
  if: \${{ parameters.pushToGit }}
  input:
    repoUrl: ${repoUrl}
    branchName: create-\${{ parameters.${nameParam} }}-resource
    title: Create {KIND} Resource \${{ parameters.${nameParam} }}
    description: Create {KIND} Resource \${{ parameters.${nameParam} }}
    targetBranchName: ${targetBranch}
  `;
  }

  /**
   * Populates XRD placeholders in the steps YAML
   */
  private populateXRDPlaceholders(stepsYaml: string, version: any, xrd: any): string {
    const apiVersion = `${xrd.spec.group}/${version.name}`;
    const kind = CrossplaneVersionHandler.getResourceKind(xrd);

    return stepsYaml
      .replaceAll('{API_VERSION}', apiVersion)
      .replaceAll('{KIND}', kind);
  }
}