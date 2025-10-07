/**
 * Helper functions for Eta templates
 */

import { PropertyInfo, TemplateHelpers } from '../lib/types';
import * as yaml from 'js-yaml';

/**
 * Create helper functions for use in Eta templates
 */
export function createHelpers(): TemplateHelpers {
  return {
    /**
     * Convert text to a valid Kubernetes name
     */
    slugify: (text: string): string => {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/--+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 63);
    },

    /**
     * Extract a title from XRD
     */
    extractTitle: (xrd: any): string => {
      // Try annotations first
      const annotationTitle = xrd?.metadata?.annotations?.['backstage.io/title'] ||
                             xrd?.metadata?.annotations?.['openportal.dev/title'];
      if (annotationTitle) return annotationTitle;

      // Fall back to spec.names.kind
      if (xrd?.spec?.names?.kind) {
        // Convert PascalCase to Title Case
        return xrd.spec.names.kind
          .replace(/([A-Z])/g, ' $1')
          .trim();
      }

      // Last resort: use metadata.name
      if (xrd?.metadata?.name) {
        return xrd.metadata.name
          .split('.')
          .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
      }

      return 'Resource';
    },

    /**
     * Extract properties from XRD schema
     */
    extractProperties: (xrd: any): PropertyInfo[] => {
      const properties: PropertyInfo[] = [];

      // Get the first version's schema
      const version = xrd?.spec?.versions?.[0];
      if (!version?.schema?.openAPIV3Schema) {
        return properties;
      }

      const schema = version.schema.openAPIV3Schema;
      const specProperties = schema?.properties?.spec?.properties;

      if (!specProperties) {
        return properties;
      }

      const required = schema?.properties?.spec?.required || [];

      // Convert OpenAPI schema to PropertyInfo
      for (const [name, prop] of Object.entries(specProperties)) {
        const property = prop as any;

        properties.push({
          name,
          title: property.title || name.charAt(0).toUpperCase() + name.slice(1),
          type: mapOpenAPIType(property.type),
          description: property.description,
          required: required.includes(name),
          default: property.default,
          enum: property.enum,
          pattern: property.pattern,
          minLength: property.minLength,
          maxLength: property.maxLength,
          minimum: property.minimum,
          maximum: property.maximum,
        });
      }

      return properties;
    },

    /**
     * Filter properties by excluding specific field names
     * Usage in templates: {{#with (filterProperties (extractProperties xrd) "name" "namespace") as |props|}}
     */
    filterProperties: (properties: PropertyInfo[], ...excludeFields: string[]): PropertyInfo[] => {
      // Filter out any fields that match the exclude list
      return properties.filter(prop => !excludeFields.includes(prop.name));
    },

    /**
     * Generate validation rules from schema
     */
    generateValidation: (schema: any): any => {
      const validation: any = {};

      if (schema.pattern) {
        validation.pattern = schema.pattern;
      }
      if (schema.minLength !== undefined) {
        validation.minLength = schema.minLength;
      }
      if (schema.maxLength !== undefined) {
        validation.maxLength = schema.maxLength;
      }
      if (schema.minimum !== undefined) {
        validation.minimum = schema.minimum;
      }
      if (schema.maximum !== undefined) {
        validation.maximum = schema.maximum;
      }
      if (schema.enum) {
        validation.enum = schema.enum;
      }

      return Object.keys(validation).length > 0 ? validation : undefined;
    },

    /**
     * Convert object to YAML
     */
    toYaml: (obj: any): string => {
      return yaml.dump(obj, {
        skipInvalid: true,
        noRefs: true,
        sortKeys: false
      });
    },

    /**
     * Convert object to JSON
     */
    toJson: (obj: any): string => {
      return JSON.stringify(obj, null, 2);
    },

    /**
     * Get annotation value from XRD
     */
    getAnnotation: (xrd: any, key: string): string | undefined => {
      return xrd?.metadata?.annotations?.[key];
    },

    /**
     * Get label value from XRD
     */
    getLabel: (xrd: any, key: string): string | undefined => {
      return xrd?.metadata?.labels?.[key];
    },
  };
}

/**
 * Map OpenAPI types to Backstage form types
 */
function mapOpenAPIType(openAPIType: string): string {
  const typeMap: Record<string, string> = {
    'string': 'string',
    'integer': 'number',
    'number': 'number',
    'boolean': 'boolean',
    'array': 'array',
    'object': 'object',
  };

  return typeMap[openAPIType] || 'string';
}