import { Entity } from '@backstage/catalog-model';
import { BaseBuilder } from './BaseBuilder';

/**
 * Builder for creating API entities
 */
export class APIEntityBuilder extends BaseBuilder<Entity> {

  constructor() {
    super({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: {
        name: '',
        title: '',
        annotations: {},
      },
      spec: {
        type: 'openapi',
        lifecycle: 'production',
        owner: 'kubernetes-auto-ingested',
        system: 'kubernets-auto-ingested',
        definition: '',
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

  withAnnotations(annotations: Record<string, string>): this {
    this.data.metadata.annotations = {
      ...this.data.metadata.annotations,
      ...annotations,
    };
    return this;
  }

  withDefinition(definition: string): this {
    this.data.spec!.definition = definition;
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

  withLifecycle(lifecycle: string): this {
    this.data.spec!.lifecycle = lifecycle;
    return this;
  }

  withType(type: string): this {
    this.data.spec!.type = type;
    return this;
  }

  /**
   * Sets XRD version-specific metadata and definition
   */
  withXRDVersion(xrd: any, version: any): this {
    const name = `${xrd.spec.names.kind.toLowerCase()}-${xrd.spec.group}--${version.name}`;
    return this
      .withName(name)
      .withTitle(name)
      .withAnnotations({
        'backstage.io/managed-by-location': `cluster origin: ${xrd.clusterName}`,
        'backstage.io/managed-by-origin-location': `cluster origin: ${xrd.clusterName}`,
      });
  }

  /**
   * Sets OpenAPI definition
   */
  withOpenAPIDefinition(definition: string): this {
    return this.withDefinition(definition);
  }

  /**
   * Sets standard API metadata for XRD/CRD
   */
  withResourceAPIMetadata(
    resourceKind: string,
    group: string,
    version: string,
    clusterName: string
  ): this {
    const name = `${resourceKind?.toLowerCase()}-${group}--${version}`;
    return this
      .withName(name)
      .withTitle(name)
      .withAnnotations({
        'backstage.io/managed-by-location': `cluster origin: ${clusterName}`,
        'backstage.io/managed-by-origin-location': `cluster origin: ${clusterName}`,
      });
  }

}