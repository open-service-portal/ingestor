import { Entity } from '@backstage/catalog-model';
import { BackstageLink } from '../interfaces';

/**
 * Builder for creating Backstage System entities
 */
export class SystemEntityBuilder {
  private entity: Partial<Entity> = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: '',
      annotations: {},
      links: [],
    },
    spec: {
      owner: 'unknown',
    },
  };

  /**
   * Set the system name
   */
  withName(name: string): this {
    this.entity.metadata!.name = name;
    return this;
  }

  /**
   * Set the system title
   */
  withTitle(title: string): this {
    this.entity.metadata!.title = title;
    return this;
  }

  /**
   * Set the system description
   */
  withDescription(description: string): this {
    this.entity.metadata!.description = description;
    return this;
  }

  /**
   * Set the system owner
   */
  withOwner(owner: string): this {
    this.entity.spec!.owner = owner;
    return this;
  }

  /**
   * Set the domain for this system
   */
  withDomain(domain: string): this {
    this.entity.spec!.domain = domain;
    return this;
  }

  /**
   * Set tags
   */
  withTags(tags: string[]): this {
    this.entity.metadata!.tags = tags;
    return this;
  }

  /**
   * Add links to the system
   */
  withLinks(links: BackstageLink[]): this {
    if (links && links.length > 0) {
      this.entity.metadata!.links = links;
    }
    return this;
  }

  /**
   * Add or merge annotations
   */
  withAnnotations(annotations: Record<string, string>): this {
    this.entity.metadata!.annotations = {
      ...this.entity.metadata!.annotations,
      ...annotations,
    };
    return this;
  }

  /**
   * Set Kubernetes-specific metadata
   */
  withKubernetesMetadata(
    namespace: string,
    clusterName: string,
    _prefix: string, // Kept for API compatibility
    customAnnotations: Record<string, string>,
  ): this {
    const name = `${namespace}-${clusterName}`;
    this.entity.metadata!.name = name;
    this.entity.metadata!.title = namespace;
    this.entity.metadata!.description = `Kubernetes namespace ${namespace} in cluster ${clusterName}`;

    this.entity.metadata!.annotations = {
      ...this.entity.metadata!.annotations,
      'openportal.dev/kubernetes-namespace': namespace,
      'backstage.io/kubernetes-cluster': clusterName,
      ...customAnnotations,
    };

    return this;
  }

  /**
   * Set Kubernetes system metadata from resource
   */
  withKubernetesSystemMetadata(
    resource: any,
    systemName: string,
    systemNamespace: string,
    _systemReferencesNamespace: string,
    prefix: string,
    customAnnotations: Record<string, string>,
  ): this {
    const annotations = resource.metadata?.annotations || {};
    const labels = resource.metadata?.labels || {};

    // Set system name
    this.entity.metadata!.name = systemName;

    // Set title from annotation or system name
    if (annotations[`${prefix}/title`] || annotations['backstage.io/title']) {
      this.entity.metadata!.title = annotations[`${prefix}/title`] || annotations['backstage.io/title'];
    } else {
      this.entity.metadata!.title = systemName;
    }

    // Set description
    if (annotations[`${prefix}/description`] || annotations['backstage.io/description']) {
      this.entity.metadata!.description = annotations[`${prefix}/description`] || annotations['backstage.io/description'];
    }

    // Set owner
    const owner = annotations[`${prefix}/owner`] || annotations['backstage.io/owner'] || 'unknown';
    this.entity.spec!.owner = owner;

    // Set domain if provided
    const domain = annotations[`${prefix}/domain`] || annotations['backstage.io/domain'];
    if (domain) {
      this.entity.spec!.domain = domain;
    }

    // Set tags
    const tags = annotations[`${prefix}/tags`] || annotations['openportal.dev/tags'] || labels[`${prefix}/tags`];
    if (tags) {
      this.entity.metadata!.tags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
    }

    // Set annotations
    this.entity.metadata!.annotations = {
      ...this.entity.metadata!.annotations,
      'openportal.dev/kubernetes-namespace': systemNamespace,
      'backstage.io/kubernetes-cluster': resource.clusterName,
      ...customAnnotations,
    };

    return this;
  }

  /**
   * Build and return the final entity
   */
  build(): Entity {
    // Validate required fields
    if (!this.entity.metadata!.name) {
      throw new Error('System entity must have a name');
    }

    return this.entity as Entity;
  }
}
