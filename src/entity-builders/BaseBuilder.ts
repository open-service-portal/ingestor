import yaml from 'js-yaml';

/**
 * Base builder class that supports multiple output formats
 */
export abstract class BaseBuilder<T> {
  protected data: T;

  constructor(initialData: T) {
    this.data = initialData;
  }

  /**
   * Build and return as JavaScript object
   */
  build(): T {
    return this.data;
  }

  /**
   * Build and return as YAML string
   */
  buildAsYaml(): string {
    return yaml.dump(this.data);
  }

  /**
   * Build and return as JSON string
   */
  buildAsJson(): string {
    return JSON.stringify(this.data, null, 2);
  }

  /**
   * Build and return as formatted JSON string
   */
  buildAsJsonCompact(): string {
    return JSON.stringify(this.data);
  }

  /**
   * Get the current data without building (for inspection)
   */
  getData(): T {
    return this.data;
  }

  /**
   * Validate the built object (can be overridden by subclasses)
   */
  validate(): boolean {
    return true;
  }
}