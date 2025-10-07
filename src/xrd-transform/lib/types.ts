/**
 * Types for XRD Transform
 */

export interface XRDExtractData {
  source: 'kubernetes' | 'file' | 'git' | string;
  timestamp: string;
  xrd: any; // Full XRD object
  metadata?: {
    cluster?: string;
    namespace?: string;
    path?: string;
    [key: string]: any;
  };
}

export interface TransformOptions {
  /** Directory containing Handlebars templates (defaults to package root/templates) */
  templateDir?: string;
  /** Template name override (e.g., "debug", "default") - overrides XRD annotation */
  templateName?: string;
  /** Additional context to pass to templates */
  context?: Record<string, any>;
  /** Output format */
  format?: 'yaml' | 'json';
  /** Verbose logging */
  verbose?: boolean;
  /** Validate output */
  validate?: boolean;
}

export interface TransformResult {
  success: boolean;
  entities: any[];
  errors?: string[];
}

export interface TemplateConfig {
  /** Main Backstage template (openportal.dev/template) */
  backstageTemplate?: string;
  /** API documentation template (openportal.dev/api-template) */
  apiTemplate?: string;
  /** Parameters section template (openportal.dev/parameters-template) */
  parametersTemplate?: string;
  /** Steps section template (openportal.dev/steps-template) */
  stepsTemplate?: string;
}

export interface TemplateHelpers {
  slugify: (text: string) => string;
  extractTitle: (xrd: any) => string;
  extractProperties: (xrd: any) => PropertyInfo[];
  filterProperties: (properties: PropertyInfo[], ...excludeFields: string[]) => PropertyInfo[];
  generateValidation: (schema: any) => any;
  toYaml: (obj: any) => string;
  toJson: (obj: any) => string;
  getAnnotation: (xrd: any, key: string) => string | undefined;
  getLabel: (xrd: any, key: string) => string | undefined;
}

export interface PropertyInfo {
  name: string;
  title: string;
  type: string;
  description?: string;
  required?: boolean;
  default?: any;
  enum?: any[];
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}