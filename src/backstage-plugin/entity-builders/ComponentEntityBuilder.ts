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
    nameModel: string = 'name-namespace-cluster',
    titleModel: string = 'name',
  ): this {
    const annotations = resource.metadata?.annotations || {};
    const labels = resource.metadata?.labels || {};
    const namespace = resource.metadata?.namespace || 'default';
    const resourceName = resource.metadata.name;
    const kind = resource.kind;

    // Set entity name based on nameModel
    this.entity.metadata!.name = this.buildEntityName(
      resourceName,
      namespace,
      clusterName,
      nameModel
    );

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

    // Set title from annotation or titleModel
    const annotationTitle = annotations[`${prefix}/title`] || annotations['backstage.io/title'];
    if (annotationTitle) {
      this.entity.metadata!.title = annotationTitle;
    } else {
      this.entity.metadata!.title = this.buildEntityTitle(
        resourceName,
        namespace,
        clusterName,
        kind,
        titleModel
      );
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
   * Build entity name based on nameModel configuration
   */
  private buildEntityName(
    name: string,
    namespace: string,
    cluster: string,
    model: string
  ): string {
    switch (model.toLowerCase()) {
      case 'name':
        return name;
      case 'name-cluster':
        return `${name}-${cluster}`;
      case 'name-namespace':
        return `${name}-${namespace}`;
      case 'name-namespace-cluster':
      default:
        return `${name}-${namespace}-${cluster}`;
    }
  }

  /**
   * Build entity title based on titleModel configuration
   */
  private buildEntityTitle(
    name: string,
    namespace: string,
    cluster: string,
    kind: string,
    model: string
  ): string {
    switch (model.toLowerCase()) {
      case 'name':
        return name;
      case 'name-cluster':
        return `${name} (${cluster})`;
      case 'name-namespace':
        return `${name} (${namespace})`;
      case 'kind-name':
        return `${kind}: ${name}`;
      case 'kind-name-cluster':
        return `${kind}: ${name} (${cluster})`;
      default:
        return name;
    }
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
    nameModel: string = 'name-namespace-cluster',
    titleModel?: string,
  ): this {
    return this.withKubernetesMetadata(
      claim,
      clusterName,
      systemNamespace,
      systemName,
      systemReferencesNamespace,
      prefix,
      nameModel,
      titleModel
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
    nameModel: string = 'name-namespace-cluster',
    titleModel?: string,
  ): this {
    return this.withKubernetesMetadata(
      xr,
      clusterName,
      systemNamespace,
      systemName,
      systemReferencesNamespace,
      prefix,
      nameModel,
      titleModel
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
