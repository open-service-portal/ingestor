import { Entity } from '@backstage/catalog-model';

/**
 * Common interface for all template handlers
 */
export interface ITemplateHandler {
  /**
   * Generate template entities for an XRD version
   */
  generateTemplates(xrd: any, version: any, clusters: string[]): Entity;

  /**
   * Extract parameters for the template
   */
  extractParameters(version: any, clusters: string[], xrd: any): any[];

  /**
   * Extract steps for the template
   */
  extractSteps(version: any, xrd: any): any[];

  /**
   * Get the handler name/type
   */
  getHandlerType(): string;

  /**
   * Check if this handler can handle the given XRD
   */
  canHandle(xrd: any): boolean;
}

/**
 * Factory for creating appropriate template handler
 */
export class TemplateHandlerFactory {
  constructor(
    private readonly v1Handler: ITemplateHandler,
    private readonly v2Handler: ITemplateHandler
  ) {}

  /**
   * Get the appropriate handler for an XRD
   */
  getHandler(xrd: any): ITemplateHandler {
    // Let handlers decide if they can handle it
    if (this.v2Handler.canHandle(xrd)) {
      return this.v2Handler;
    }
    return this.v1Handler;
  }
}