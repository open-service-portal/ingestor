import { Entity } from '@backstage/catalog-model';
import { BackstageLink } from '../interfaces';
import { BaseBuilder } from './BaseBuilder';

/**
 * Builder for creating Component entities
 */
export class ComponentEntityBuilder extends BaseBuilder<Entity> {

  constructor() {
    super({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: '',
        title: '',
        description: '',
        namespace: 'default',
        tags: [],
        links: [],
        annotations: {},
      },
      spec: {
        type: 'service',
        lifecycle: 'production',
        owner: 'kubernetes-auto-ingested',
        system: 'default',
      },
    });
  }

  withName(name: string): this {
    this.data.metadata.name = name;
    return this;
  }

  withTitle(title: string): this {
    this.data.metadata.title = title;
    return this;
  }

  withDescription(description: string): this {
    this.data.metadata.description = description;
    return this;
  }

  withNamespace(namespace: string): this {
    this.data.metadata.namespace = namespace;
    return this;
  }

  withTags(tags: string[]): this {
    this.data.metadata.tags = tags;
    return this;
  }

  withLinks(links: BackstageLink[]): this {
    this.data.metadata.links = links;
    return this;
  }

  withAnnotations(annotations: Record<string, string>): this {
    this.data.metadata.annotations = {
      ...this.data.metadata.annotations,
      ...annotations,
    };
    return this;
  }

  withType(type: string): this {
    this.data.spec!.type = type;
    return this;
  }

  withLifecycle(lifecycle: string): this {
    this.data.spec!.lifecycle = lifecycle;
    return this;
  }

  withOwner(owner: string): this {
    this.data.spec!.owner = owner;
    return this;
  }

  withSystem(system: string): this {
    this.data.spec!.system = system;
    return this;
  }

  withDependsOn(dependsOn: string[] | undefined): this {
    if (dependsOn) {
      this.data.spec!.dependsOn = dependsOn;
    }
    return this;
  }

  withProvidesApis(apis: string[] | undefined): this {
    if (apis) {
      this.data.spec!.providesApis = apis;
    }
    return this;
  }

  withConsumesApis(apis: string[] | undefined): this {
    if (apis) {
      this.data.spec!.consumesApis = apis;
    }
    return this;
  }

  withSubcomponentOf(subcomponentOf: string | undefined): this {
    if (subcomponentOf) {
      this.data.spec!.subcomponentOf = subcomponentOf;
    }
    return this;
  }

  /**
   * Sets standard Kubernetes resource metadata
   */
  withKubernetesMetadata(
    resource: any,
    clusterName: string,
    systemNamespaceValue: string,
    systemNameValue: string,
    systemReferencesNamespaceValue: string,
    prefix: string
  ): this {
    const annotations = resource.metadata.annotations || {};

    return this
      .withName(annotations[`${prefix}/name`] || resource.metadata.name)
      .withTitle(annotations[`${prefix}/title`] || resource.metadata.name)
      .withDescription(`${resource.kind} ${resource.metadata.name} from ${clusterName}`)
      .withNamespace(annotations[`${prefix}/backstage-namespace`] || systemNamespaceValue)
      .withTags([`cluster:${clusterName}`, `kind:${resource.kind?.toLowerCase()}`])
      .withType(annotations[`${prefix}/component-type`] || 'service')
      .withLifecycle(annotations[`${prefix}/lifecycle`] || 'production')
      .withOwner(
        annotations[`${prefix}/owner`]
          ? `${systemReferencesNamespaceValue}/${annotations[`${prefix}/owner`]}`
          : `${systemReferencesNamespaceValue}/kubernetes-auto-ingested`
      )
      .withSystem(
        annotations[`${prefix}/system`] || `${systemReferencesNamespaceValue}/${systemNameValue}`
      )
      .withDependsOn(annotations[`${prefix}/dependsOn`]?.split(','))
      .withProvidesApis(annotations[`${prefix}/providesApis`]?.split(','))
      .withConsumesApis(annotations[`${prefix}/consumesApis`]?.split(','))
      .withSubcomponentOf(annotations[`${prefix}/subcomponent-of`]);
  }

  /**
   * Sets Crossplane claim metadata
   */
  withCrossplaneClaimMetadata(
    claim: any,
    clusterName: string,
    systemNamespaceValue: string,
    systemNameValue: string,
    systemReferencesNamespaceValue: string,
    prefix: string
  ): this {
    const annotations = claim.metadata.annotations || {};

    return this
      .withName(annotations[`${prefix}/name`] || claim.metadata.name)
      .withTitle(annotations[`${prefix}/title`] || claim.metadata.name)
      .withNamespace(annotations[`${prefix}/backstage-namespace`] || systemNamespaceValue)
      .withTags([`cluster:${clusterName}`, `kind:${claim.kind?.toLowerCase()}`])
      .withType('crossplane-claim')
      .withLifecycle(annotations[`${prefix}/lifecycle`] || 'production')
      .withOwner(
        annotations[`${prefix}/owner`]
          ? `${systemReferencesNamespaceValue}/${annotations[`${prefix}/owner`]}`
          : `${systemReferencesNamespaceValue}/kubernetes-auto-ingested`
      )
      .withSystem(
        annotations[`${prefix}/system`] || `${systemReferencesNamespaceValue}/${systemNameValue}`
      )
      .withConsumesApis([`${systemReferencesNamespaceValue}/${claim.kind}-${claim.apiVersion.split('/').join('--')}`])
      .withSubcomponentOf(annotations[`${prefix}/subcomponent-of`]);
  }

  /**
   * Sets Crossplane XR metadata
   */
  withCrossplaneXRMetadata(
    xr: any,
    clusterName: string,
    systemNamespaceValue: string,
    systemNameValue: string,
    systemReferencesNamespaceValue: string,
    prefix: string
  ): this {
    const annotations = xr.metadata.annotations || {};

    return this
      .withName(annotations[`${prefix}/name`] || xr.metadata.name)
      .withTitle(annotations[`${prefix}/title`] || xr.metadata.name)
      .withNamespace(annotations[`${prefix}/backstage-namespace`] || systemNamespaceValue)
      .withTags([`cluster:${clusterName}`, `kind:${xr.kind?.toLowerCase()}`])
      .withType('crossplane-xr')
      .withLifecycle(annotations[`${prefix}/lifecycle`] || 'production')
      .withOwner(annotations[`${prefix}/owner`] || 'kubernetes-auto-ingested')
      .withSystem(
        annotations[`${prefix}/system`] || `${systemReferencesNamespaceValue}/${systemNameValue}`
      )
      .withConsumesApis([`${systemReferencesNamespaceValue}/${xr.kind}-${xr.apiVersion.split('/').join('--')}`])
      .withSubcomponentOf(annotations[`${prefix}/subcomponent-of`]);
  }

}