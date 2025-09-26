import { Entity } from '@backstage/catalog-model';
import { BaseBuilder } from './BaseBuilder';

/**
 * Builder for creating System entities
 */
export class SystemEntityBuilder extends BaseBuilder<Entity> {

  constructor() {
    super({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: {
        name: '',
        namespace: 'default',
        annotations: {},
      },
      spec: {
        owner: 'kubernetes-auto-ingested',
        type: 'kubernetes-namespace',
      },
    });
  }

  withName(name: string): this {
    this.data.metadata.name = name;
    return this;
  }

  withNamespace(namespace: string): this {
    this.data.metadata.namespace = namespace;
    return this;
  }

  withAnnotations(annotations: Record<string, string>): this {
    this.data.metadata.annotations = {
      ...this.data.metadata.annotations,
      ...annotations,
    };
    return this;
  }

  withOwner(owner: string): this {
    this.data.spec!.owner = owner;
    return this;
  }

  withType(type: string): this {
    this.data.spec!.type = type;
    return this;
  }

  withDomain(domain: string | undefined): this {
    if (domain) {
      this.data.spec!.domain = domain;
    }
    return this;
  }

  /**
   * Sets standard Kubernetes system metadata
   */
  withKubernetesSystemMetadata(
    resource: any,
    systemNameValue: string,
    systemNamespaceValue: string,
    systemReferencesNamespaceValue: string,
    prefix: string,
    customAnnotations: Record<string, string>
  ): this {
    const annotations = resource.metadata.annotations || {};

    return this
      .withName(systemNameValue)
      .withNamespace(annotations[`${prefix}/backstage-namespace`] || systemNamespaceValue)
      .withAnnotations(customAnnotations)
      .withOwner(
        annotations[`${prefix}/owner`]
          ? `${systemReferencesNamespaceValue}/${annotations[`${prefix}/owner`]}`
          : `${systemReferencesNamespaceValue}/kubernetes-auto-ingested`
      )
      .withType(annotations[`${prefix}/system-type`] || 'kubernetes-namespace')
      .withDomain(annotations[`${prefix}/domain`]);
  }

}