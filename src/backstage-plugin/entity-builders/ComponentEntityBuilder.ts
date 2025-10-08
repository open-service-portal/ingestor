import { Entity } from '@backstage/catalog-model';
import { BackstageLink } from '../interfaces';

/**
 * Builder for creating Backstage Component entities from Kubernetes resources
 */
export class ComponentEntityBuilder {
  private entity: Partial<Entity> = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: '',
      annotations: {},
      links: [],
    },
    spec: {
      type: 'service',
      lifecycle: 'experimental',
      owner: 'unknown',
    },
  };

  /**
   * Set basic Kubernetes metadata for the component
   */
  withKubernetesMetadata(
    resource: any,
    clusterName: string,
    _systemNamespace?: string,
    systemName?: string,
    _systemReferencesNamespace?: string,
    prefix: string = 'backstage.io',
  ): this {
    const annotations = resource.metadata?.annotations || {};
    const labels = resource.metadata?.labels || {};

    // Set entity name
    const namespace = resource.metadata?.namespace || 'default';
    this.entity.metadata!.name = `${resource.metadata.name}-${namespace}-${clusterName}`;

    // Set basic spec fields
    this.entity.spec = {
      ...this.entity.spec,
      type: annotations[`${prefix}/type`] || labels[`${prefix}/type`] || 'service',
      lifecycle: annotations[`${prefix}/lifecycle`] || annotations['backstage.io/lifecycle'] || 'experimental',
      owner: annotations[`${prefix}/owner`] || annotations['backstage.io/owner'] || 'unknown',
    };

    // Set system if provided
    if (systemName) {
      this.entity.spec.system = systemName;
    }

    // Set title from annotation or resource name
    if (annotations[`${prefix}/title`] || annotations['backstage.io/title']) {
      this.entity.metadata!.title = annotations[`${prefix}/title`] || annotations['backstage.io/title'];
    }

    // Set description
    if (annotations[`${prefix}/description`] || annotations['backstage.io/description']) {
      this.entity.metadata!.description = annotations[`${prefix}/description`] || annotations['backstage.io/description'];
    }

    // Set tags
    const tags = annotations[`${prefix}/tags`] || annotations['openportal.dev/tags'] || labels[`${prefix}/tags`];
    if (tags) {
      this.entity.metadata!.tags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
    }

    return this;
  }

  /**
   * Add links to the component
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
   * Set the entity name directly
   */
  withName(name: string): this {
    this.entity.metadata!.name = name;
    return this;
  }

  /**
   * Set the entity title
   */
  withTitle(title: string): this {
    this.entity.metadata!.title = title;
    return this;
  }

  /**
   * Set the entity description
   */
  withDescription(description: string): this {
    this.entity.metadata!.description = description;
    return this;
  }

  /**
   * Set the component type
   */
  withType(type: string): this {
    this.entity.spec!.type = type;
    return this;
  }

  /**
   * Set the lifecycle
   */
  withLifecycle(lifecycle: string): this {
    this.entity.spec!.lifecycle = lifecycle;
    return this;
  }

  /**
   * Set the owner
   */
  withOwner(owner: string): this {
    this.entity.spec!.owner = owner;
    return this;
  }

  /**
   * Set the system
   */
  withSystem(system: string): this {
    this.entity.spec!.system = system;
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
   * Set Crossplane Claim metadata
   */
  withCrossplaneClaimMetadata(
    claim: any,
    clusterName: string,
    systemNamespace?: string,
    systemName?: string,
    systemReferencesNamespace?: string,
    prefix: string = 'backstage.io',
  ): this {
    return this.withKubernetesMetadata(
      claim,
      clusterName,
      systemNamespace,
      systemName,
      systemReferencesNamespace,
      prefix
    );
  }

  /**
   * Set Crossplane XR (Composite Resource) metadata
   */
  withCrossplaneXRMetadata(
    xr: any,
    clusterName: string,
    systemNamespace?: string,
    systemName?: string,
    systemReferencesNamespace?: string,
    prefix: string = 'backstage.io',
  ): this {
    return this.withKubernetesMetadata(
      xr,
      clusterName,
      systemNamespace,
      systemName,
      systemReferencesNamespace,
      prefix
    );
  }

  /**
   * Build and return the final entity
   */
  build(): Entity {
    // Validate required fields
    if (!this.entity.metadata!.name) {
      throw new Error('Component entity must have a name');
    }

    return this.entity as Entity;
  }
}
