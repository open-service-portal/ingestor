import { BaseBuilder } from './BaseBuilder';

interface Step {
  id: string;
  name: string;
  action: string;
  input?: any;
  if?: string;
}

/**
 * Builder for creating scaffolder template steps
 * Can output as array of steps or as YAML
 */
export class StepsBuilder extends BaseBuilder<Step[]> {
  constructor() {
    super([]);
  }

  /**
   * Add a generate manifest step
   */
  addGenerateManifestStep(options: {
    nameParam: string;
    namespaceParam?: string;
    ownerParam?: string;
    excludeParams: string[];
    apiVersion: string;
    kind: string;
    clusters?: string;
    removeEmptyParams?: boolean;
  }): this {
    const step: Step = {
      id: 'generateManifest',
      name: 'Generate Kubernetes Resource Manifest',
      action: options.namespaceParam ? 'terasky:claim-template' : 'terasky:crd-template',
      input: {
        parameters: '${{ parameters }}',
        nameParam: options.nameParam,
        ...(options.namespaceParam && { namespaceParam: options.namespaceParam }),
        ...(options.ownerParam && { ownerParam: options.ownerParam }),
        excludeParams: options.excludeParams,
        apiVersion: options.apiVersion,
        kind: options.kind,
        ...(options.clusters && { clusters: options.clusters }),
        ...(options.removeEmptyParams && { removeEmptyParams: options.removeEmptyParams }),
      },
    };
    this.data.push(step);
    return this;
  }

  /**
   * Add a move namespaced manifest step
   */
  addMoveNamespacedManifestStep(namespaceParam: string = 'xrNamespace'): this {
    const step: Step = {
      id: 'moveNamespacedManifest',
      name: 'Move and Rename Manifest',
      action: 'fs:rename',
      if: '${{ parameters.manifestLayout === \'namespace-scoped\' }}',
      input: {
        files: [
          {
            from: '${{ steps.generateManifest.output.filePaths[0] }}',
            to: `./$\{{ parameters.${namespaceParam} }}/$\{{ steps.generateManifest.input.kind }}/$\{{ steps.generateManifest.output.filePaths[0].split('/').pop() }}`,
          },
        ],
      },
    };
    this.data.push(step);
    return this;
  }

  /**
   * Add a move custom manifest step
   */
  addMoveCustomManifestStep(nameParam: string = 'xrName'): this {
    const step: Step = {
      id: 'moveCustomManifest',
      name: 'Move and Rename Manifest',
      action: 'fs:rename',
      if: '${{ parameters.manifestLayout === \'custom\' }}',
      input: {
        files: [
          {
            from: '${{ steps.generateManifest.output.filePaths[0] }}',
            to: `./$\{{ parameters.basePath }}/$\{{ parameters.${nameParam} }}.yaml`,
          },
        ],
      },
    };
    this.data.push(step);
    return this;
  }

  /**
   * Add a create pull request step
   */
  addCreatePullRequestStep(options: {
    action: string;
    repoUrl: string;
    nameParam: string;
    targetBranch?: string;
    kind: string;
  }): this {
    const step: Step = {
      id: 'create-pull-request',
      name: 'create-pull-request',
      action: options.action,
      if: '${{ parameters.pushToGit }}',
      input: {
        repoUrl: options.repoUrl,
        branchName: `create-$\{{ parameters.${options.nameParam} }}-resource`,
        title: `Create ${options.kind} Resource $\{{ parameters.${options.nameParam} }}`,
        description: `Create ${options.kind} Resource $\{{ parameters.${options.nameParam} }}`,
        ...(options.targetBranch && { targetBranchName: options.targetBranch }),
      },
    };
    this.data.push(step);
    return this;
  }

  /**
   * Add a custom step
   */
  addCustomStep(step: Step): this {
    this.data.push(step);
    return this;
  }

  /**
   * Add multiple steps at once
   */
  addSteps(steps: Step[]): this {
    this.data.push(...steps);
    return this;
  }

  /**
   * Clear all steps
   */
  clear(): this {
    this.data = [];
    return this;
  }
}