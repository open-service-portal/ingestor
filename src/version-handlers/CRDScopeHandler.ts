/**
 * Handles CRD scope-specific logic
 */
export class CRDScopeHandler {
  /**
   * Checks if the CRD is namespace-scoped
   */
  static isNamespaced(crd: any): boolean {
    return crd.spec?.scope === 'Namespaced';
  }

  /**
   * Checks if the CRD is cluster-scoped
   */
  static isCluster(crd: any): boolean {
    return crd.spec?.scope === 'Cluster';
  }

  /**
   * Gets the scope of the CRD
   */
  static getScope(crd: any): string {
    return crd.spec?.scope || 'Cluster';
  }

  /**
   * Determines if namespace parameter should be included
   */
  static shouldIncludeNamespace(crd: any): boolean {
    return this.isNamespaced(crd);
  }

  /**
   * Gets the namespace parameter for YAML generation
   */
  static getNamespaceParam(crd: any): string {
    return this.isNamespaced(crd) ? 'namespace' : '';
  }

  /**
   * Gets the namespace parameter YAML line
   */
  static getNamespaceParamYaml(crd: any): string {
    return this.isNamespaced(crd)
      ? '    namespaceParam: namespace\n'
      : '    namespaceParam: ""\n';
  }

  /**
   * Gets namespace-specific metadata properties for parameters
   */
  static getNamespaceMetadata(crd: any): any {
    if (!this.isNamespaced(crd)) {
      return {};
    }

    return {
      namespace: {
        title: 'Namespace',
        description: 'The namespace in which to create the resource',
        pattern: "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$",
        maxLength: 63,
        type: 'string',
      }
    };
  }
}