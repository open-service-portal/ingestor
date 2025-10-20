/**
 * XRD Transform - Transform XRDs into Backstage templates using Eta
 */

export { XRDTransformer, transform } from './lib/transform';
export type {
  XRDExtractData,
  TransformOptions,
  TransformResult,
  TemplateConfig,
  TemplateHelpers,
  PropertyInfo
} from './lib/types';
export { createHelpers } from './helpers';