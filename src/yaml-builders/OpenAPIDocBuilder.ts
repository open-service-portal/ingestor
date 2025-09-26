import yaml from 'js-yaml';
import { CrossplaneVersionHandler } from '../version-handlers/CrossplaneVersionHandler';
import { CRDScopeHandler } from '../version-handlers/CRDScopeHandler';

/**
 * Builds OpenAPI documentation for XRDs and CRDs
 */
export class OpenAPIDocBuilder {
  /**
   * Builds OpenAPI document for XRD
   */
  buildXRDOpenAPIDoc(version: any, xrd: any): string {
    const resourcePlural = CrossplaneVersionHandler.getResourcePlural(xrd);
    const resourceKind = CrossplaneVersionHandler.getResourceKind(xrd);

    // Use generated CRD schema if available, otherwise XRD schema
    const schemaProps = this.getXRDSchemaProperties(version, xrd);

    const openAPIDoc = {
      openapi: "3.0.0",
      info: {
        title: `${resourcePlural}.${xrd.spec.group}`,
        version: version.name,
      },
      servers: this.buildServers(xrd),
      tags: this.buildTags(),
      paths: this.buildXRDPaths(xrd, version, resourcePlural, resourceKind),
      components: this.buildComponents(schemaProps),
      security: this.buildSecurity(),
    };

    return yaml.dump(openAPIDoc);
  }

  /**
   * Builds OpenAPI document for CRD
   */
  buildCRDOpenAPIDoc(version: any, crd: any): string {
    const openAPIDoc = {
      openapi: "3.0.0",
      info: {
        title: `${crd.spec.names.plural}.${crd.spec.group}`,
        version: version.name,
      },
      servers: this.buildServers(crd),
      tags: this.buildTags(),
      paths: this.buildCRDPaths(crd, version),
      components: this.buildComponents(version.schema.openAPIV3Schema.properties),
      security: this.buildSecurity(),
    };

    return yaml.dump(openAPIDoc);
  }

  /**
   * Gets schema properties for XRD
   */
  private getXRDSchemaProperties(version: any, xrd: any): any {
    // Use generated CRD schema if present
    if (xrd.generatedCRD) {
      const crdVersion = xrd.generatedCRD.spec.versions.find((v: any) => v.name === version.name) ||
                         xrd.generatedCRD.spec.versions.find((v: any) => v.storage) ||
                         xrd.generatedCRD.spec.versions[0];
      if (crdVersion?.schema?.openAPIV3Schema?.properties) {
        return crdVersion.schema.openAPIV3Schema.properties;
      }
    }

    // Fallback to XRD schema
    return version.schema.openAPIV3Schema.properties;
  }

  /**
   * Builds server definitions
   */
  private buildServers(resource: any): any[] {
    return resource.clusterDetails.map((cluster: any) => ({
      url: cluster.url,
      description: cluster.name,
    }));
  }

  /**
   * Builds tag definitions
   */
  private buildTags(): any[] {
    return [
      {
        name: "Cluster Scoped Operations",
        description: "Operations on the cluster level"
      },
      {
        name: "Namespace Scoped Operations",
        description: "Operations on the namespace level"
      },
      {
        name: "Specific Object Scoped Operations",
        description: "Operations on a specific resource"
      }
    ];
  }

  /**
   * Builds paths for XRD
   */
  private buildXRDPaths(xrd: any, version: any, resourcePlural: string, resourceKind: string): any {
    const group = xrd.spec.group;
    const versionName = version.name;

    return {
      [`/apis/${group}/${versionName}/${resourcePlural}`]: {
        get: {
          tags: ["Cluster Scoped Operations"],
          summary: `List all ${resourcePlural} in all namespaces`,
          operationId: `list${resourcePlural}AllNamespaces`,
          responses: {
            "200": {
              description: `List of ${resourcePlural} in all namespaces`,
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      $ref: `#/components/schemas/Resource`
                    }
                  }
                }
              }
            }
          }
        }
      },
      [`/apis/${group}/${versionName}/namespaces/{namespace}/${resourcePlural}`]: {
        get: {
          tags: ["Namespace Scoped Operations"],
          summary: `List all ${resourcePlural} in a namespace`,
          operationId: `list${resourcePlural}`,
          parameters: [
            {
              name: "namespace",
              in: "path",
              required: true,
              schema: {
                type: "string"
              }
            }
          ],
          responses: {
            "200": {
              description: `List of ${resourcePlural}`,
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      $ref: `#/components/schemas/Resource`
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ["Namespace Scoped Operations"],
          summary: "Create a resource",
          operationId: "createResource",
          parameters: [
            { name: "namespace", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  $ref: `#/components/schemas/Resource`
                }
              },
            },
          },
          responses: {
            "201": { description: "Resource created" },
          },
        },
      },
      [`/apis/${group}/${versionName}/namespaces/{namespace}/${resourcePlural}/{name}`]: {
        get: {
          tags: ["Specific Object Scoped Operations"],
          summary: `Get a ${resourceKind}`,
          operationId: `get${resourceKind}`,
          parameters: [
            { name: "namespace", in: "path", required: true, schema: { type: "string" } },
            { name: "name", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Resource details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    $ref: `#/components/schemas/Resource`
                  },
                },
              },
            },
          },
        },
        put: {
          tags: ["Specific Object Scoped Operations"],
          summary: "Update a resource",
          operationId: "updateResource",
          parameters: [
            { name: "namespace", in: "path", required: true, schema: { type: "string" } },
            { name: "name", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  $ref: `#/components/schemas/Resource`
                },
              },
            },
          },
          responses: {
            "200": { description: "Resource updated" },
          },
        },
        delete: {
          tags: ["Specific Object Scoped Operations"],
          summary: "Delete a resource",
          operationId: "deleteResource",
          parameters: [
            { name: "namespace", in: "path", required: true, schema: { type: "string" } },
            { name: "name", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Resource deleted" },
          },
        },
      },
    };
  }

  /**
   * Builds paths for CRD
   */
  private buildCRDPaths(crd: any, version: any): any {
    const group = crd.spec.group;
    const versionName = version.name;
    const plural = crd.spec.names.plural;
    const kind = crd.spec.names.kind;

    if (CRDScopeHandler.isCluster(crd)) {
      return this.buildClusterScopedPaths(group, versionName, plural, kind);
    } else {
      return this.buildNamespaceScopedPaths(group, versionName, plural, kind);
    }
  }

  /**
   * Builds cluster-scoped paths
   */
  private buildClusterScopedPaths(group: string, version: string, plural: string, kind: string): any {
    return {
      [`/apis/${group}/${version}/${plural}`]: {
        get: {
          tags: ["Cluster Scoped Operations"],
          summary: `List all ${plural} in all namespaces`,
          operationId: `list${plural}AllNamespaces`,
          responses: {
            "200": {
              description: `List of ${plural} in all namespaces`,
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      $ref: `#/components/schemas/Resource`
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ["Cluster Scoped Operations"],
          summary: "Create a resource",
          operationId: "createResource",
          parameters: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  $ref: `#/components/schemas/Resource`
                }
              },
            },
          },
          responses: {
            "201": { description: "Resource created" },
          },
        },
      },
      [`/apis/${group}/${version}/${plural}/{name}`]: {
        get: {
          tags: ["Specific Object Scoped Operations"],
          summary: `Get a ${kind}`,
          operationId: `get${kind}`,
          parameters: [
            { name: "name", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Resource details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    $ref: `#/components/schemas/Resource`
                  },
                },
              },
            },
          },
        },
        put: {
          tags: ["Specific Object Scoped Operations"],
          summary: "Update a resource",
          operationId: "updateResource",
          parameters: [
            { name: "name", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  $ref: `#/components/schemas/Resource`
                },
              },
            },
          },
          responses: {
            "200": { description: "Resource updated" },
          },
        },
        delete: {
          tags: ["Specific Object Scoped Operations"],
          summary: "Delete a resource",
          operationId: "deleteResource",
          parameters: [
            { name: "name", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Resource deleted" },
          },
        },
      },
    };
  }

  /**
   * Builds namespace-scoped paths (same as XRD paths structure)
   */
  private buildNamespaceScopedPaths(group: string, version: string, plural: string, kind: string): any {
    // Reuse XRD path structure for namespaced resources
    const mockXrd = {
      spec: { group },
      clusterDetails: []
    };
    const mockVersion = { name: version };

    return this.buildXRDPaths(mockXrd, mockVersion, plural, kind);
  }

  /**
   * Builds component definitions
   */
  private buildComponents(schemaProps: any): any {
    return {
      schemas: {
        Resource: {
          type: "object",
          properties: schemaProps
        }
      },
      securitySchemes: {
        bearerHttpAuthentication: {
          description: "Bearer token using a JWT",
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    };
  }

  /**
   * Builds security definitions
   */
  private buildSecurity(): any[] {
    return [
      {
        bearerHttpAuthentication: []
      }
    ];
  }
}