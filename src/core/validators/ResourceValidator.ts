/**
 * Default resource validator implementation
 */

import {
  IResourceValidator,
  Resource,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  XRD,
} from '../engine/interfaces';

export class ResourceValidator implements IResourceValidator {
  /**
   * Validate a resource for ingestion
   */
  async validate(resource: Resource): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic validation that applies to all resources
    this.validateBasicStructure(resource, errors, warnings);

    // Type-specific validation
    switch (resource.kind) {
      case 'CompositeResourceDefinition':
        this.validateXRD(resource as XRD, errors, warnings);
        break;
      case 'Deployment':
      case 'Service':
      case 'StatefulSet':
        this.validateKubernetesResource(resource, errors, warnings);
        break;
      default:
        // Unknown resource type - add warning
        warnings.push({
          field: 'kind',
          message: `Unknown resource kind: ${resource.kind}. Ingestion may not work as expected.`,
          severity: 'warning',
        });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate basic resource structure
   */
  private validateBasicStructure(
    resource: Resource,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check required fields
    if (!resource.apiVersion) {
      errors.push({
        field: 'apiVersion',
        message: 'apiVersion is required',
        severity: 'error',
      });
    }

    if (!resource.kind) {
      errors.push({
        field: 'kind',
        message: 'kind is required',
        severity: 'error',
      });
    }

    if (!resource.metadata) {
      errors.push({
        field: 'metadata',
        message: 'metadata is required',
        severity: 'error',
      });
    } else {
      if (!resource.metadata.name) {
        errors.push({
          field: 'metadata.name',
          message: 'metadata.name is required',
          severity: 'error',
        });
      }

      // Validate name format
      if (resource.metadata.name && !this.isValidDNSName(resource.metadata.name)) {
        errors.push({
          field: 'metadata.name',
          message: 'metadata.name must be a valid DNS name',
          severity: 'error',
        });
      }
    }

    // Check for deprecated fields
    if ((resource as any).deprecatedField) {
      warnings.push({
        field: 'deprecatedField',
        message: 'This field is deprecated and will be ignored',
        severity: 'warning',
      });
    }
  }

  /**
   * Validate XRD resource
   */
  private validateXRD(
    xrd: XRD,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check XRD-specific requirements
    if (!xrd.spec) {
      errors.push({
        field: 'spec',
        message: 'spec is required for XRD',
        severity: 'error',
      });
      return;
    }

    if (!xrd.spec.group) {
      errors.push({
        field: 'spec.group',
        message: 'spec.group is required for XRD',
        severity: 'error',
      });
    }

    if (!xrd.spec.names) {
      errors.push({
        field: 'spec.names',
        message: 'spec.names is required for XRD',
        severity: 'error',
      });
    } else {
      if (!xrd.spec.names.kind) {
        errors.push({
          field: 'spec.names.kind',
          message: 'spec.names.kind is required for XRD',
          severity: 'error',
        });
      }
      if (!xrd.spec.names.plural) {
        errors.push({
          field: 'spec.names.plural',
          message: 'spec.names.plural is required for XRD',
          severity: 'error',
        });
      }
    }

    if (!xrd.spec.versions || xrd.spec.versions.length === 0) {
      errors.push({
        field: 'spec.versions',
        message: 'At least one version is required for XRD',
        severity: 'error',
      });
    } else {
      // Check if at least one version is served
      const hasServedVersion = xrd.spec.versions.some(v => v.served);
      if (!hasServedVersion) {
        errors.push({
          field: 'spec.versions',
          message: 'At least one version must be served',
          severity: 'error',
        });
      }

      // Warn about versions without schemas
      xrd.spec.versions.forEach((version, index) => {
        if (!version.schema?.openAPIV3Schema) {
          warnings.push({
            field: `spec.versions[${index}].schema`,
            message: `Version ${version.name} has no schema defined`,
            severity: 'warning',
          });
        }
      });
    }

    // Check for claim names (v1 vs v2 XRDs)
    if (!xrd.spec.claimNames) {
      warnings.push({
        field: 'spec.claimNames',
        message: 'No claimNames defined - this appears to be a v2 XRD (namespaced)',
        severity: 'warning',
      });
    }
  }

  /**
   * Validate standard Kubernetes resource
   */
  private validateKubernetesResource(
    resource: Resource,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check for spec
    if (!resource.spec) {
      warnings.push({
        field: 'spec',
        message: `spec is typically required for ${resource.kind}`,
        severity: 'warning',
      });
    }

    // Check namespace for namespaced resources
    const namespacedKinds = ['Deployment', 'Service', 'ConfigMap', 'StatefulSet'];
    if (namespacedKinds.includes(resource.kind) && !resource.metadata.namespace) {
      warnings.push({
        field: 'metadata.namespace',
        message: `namespace is recommended for ${resource.kind}`,
        severity: 'warning',
      });
    }
  }

  /**
   * Validate DNS name format
   */
  private isValidDNSName(name: string): boolean {
    const dnsRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    return dnsRegex.test(name);
  }
}

/**
 * Factory function to create a resource validator
 */
export function createResourceValidator(): IResourceValidator {
  return new ResourceValidator();
}