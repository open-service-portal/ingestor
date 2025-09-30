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
  /** Directory containing Eta templates */
  templateDir: string;
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
  /** Template name from XRD annotation or default */
  backstageTemplate?: string;
  wizardTemplate?: string;
  stepsTemplate?: string;
}

export interface TemplateHelpers {
  slugify: (text: string) => string;
  extractTitle: (xrd: any) => string;
  extractProperties: (xrd: any) => PropertyInfo[];
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
  minimum?: number;
  maximum?: number;
}