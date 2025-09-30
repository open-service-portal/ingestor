/**
 * Handles Crossplane version-specific logic and scope determination
 */
export class CrossplaneVersionHandler {
  /**
   * Determines if the XRD is Crossplane v2
   */
  static isV2(xrd: any): boolean {
    return !!xrd.spec?.scope;
  }

  /**
   * Gets the Crossplane version string
   */
  static getVersion(xrd: any): string {
    return this.isV2(xrd) ? 'v2' : 'v1';
  }

  /**
   * Gets the scope for the XRD
   */
  static getScope(xrd: any): string {
    const isV2 = this.isV2(xrd);
    return xrd.spec?.scope || (isV2 ? 'LegacyCluster' : 'Cluster');
  }

  /**
   * Checks if the XRD is LegacyCluster scoped
   */
  static isLegacyCluster(xrd: any): boolean {
    const isV2 = this.isV2(xrd);
    const scope = this.getScope(xrd);
    return isV2 && scope === 'LegacyCluster';
  }

  /**
   * Checks if the XRD is Cluster scoped
   */
  static isCluster(xrd: any): boolean {
    const scope = this.getScope(xrd);
    return scope === 'Cluster';
  }

  /**
   * Checks if the XRD is Namespaced
   */
  static isNamespaced(xrd: any): boolean {
    const scope = this.getScope(xrd);
    return scope === 'Namespaced';
  }

  /**
   * Determines if claims should be used for this XRD
   * v2 Cluster/Namespaced resources don't use claims unless they're LegacyCluster
   */
  static shouldUseClaims(xrd: any): boolean {
    const isV2 = this.isV2(xrd);
    const isLegacyCluster = this.isLegacyCluster(xrd);
    const isCluster = this.isCluster(xrd);
    const isNamespaced = this.isNamespaced(xrd);

    // v2 Cluster/Namespaced don't use claims unless LegacyCluster
    if (isV2 && !isLegacyCluster && (isCluster || isNamespaced)) {
      return false;
    }

    // v1 or v2 LegacyCluster use claims
    return true;
  }

  /**
   * Gets the resource plural based on version and scope
   */
  static getResourcePlural(xrd: any): string {
    const isV2 = this.isV2(xrd);
    const isLegacyCluster = this.isLegacyCluster(xrd);

    return (!isV2 || isLegacyCluster)
      ? xrd.spec.claimNames?.plural
      : (xrd.spec.names?.plural || xrd.metadata.name);
  }

  /**
   * Gets the resource kind based on version and scope
   */
  static getResourceKind(xrd: any): string {
    const isV2 = this.isV2(xrd);
    const isLegacyCluster = this.isLegacyCluster(xrd);

    return (!isV2 || isLegacyCluster)
      ? xrd.spec.claimNames?.kind
      : (xrd.spec.names?.kind || xrd.metadata.name);
  }

  /**
   * Determines if namespace parameter should be included
   */
  static shouldIncludeNamespace(xrd: any): boolean {
    const isV2 = this.isV2(xrd);
    const isNamespaced = this.isNamespaced(xrd);
    const isLegacyCluster = this.isLegacyCluster(xrd);

    // Include namespace for: v2 Namespaced, v1, or v2 LegacyCluster
    return (isV2 && isNamespaced) || (!isV2) || isLegacyCluster;
  }

  /**
   * Gets Crossplane annotations for the entity
   */
  static getCrossplaneAnnotations(xrd: any, prefix: string): Record<string, string> {
    const version = this.getVersion(xrd);
    const scope = this.getScope(xrd);

    return {
      [`${prefix}/crossplane-version`]: version,
      [`${prefix}/crossplane-scope`]: scope,
    };
  }

  /**
   * Determines if this is a v2 direct XR (no claim)
   */
  static isDirectXR(xrd: any): boolean {
    const isV2 = this.isV2(xrd);
    const isLegacyCluster = this.isLegacyCluster(xrd);
    const isCluster = this.isCluster(xrd);
    const isNamespaced = this.isNamespaced(xrd);

    return isV2 && !isLegacyCluster && (isCluster || isNamespaced);
  }
}