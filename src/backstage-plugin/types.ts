/**
 * Backstage Plugin Types
 */

export interface IngestorConfig {
  kubernetes: {
    clusters: KubernetesClusterConfig[];
  };
  catalog?: {
    owner?: string;
    namespace?: string;
    tags?: string[];
  };
  filters?: ResourceFilter[];
  transform?: {
    templateDir?: string;
    useXRDTransform?: boolean;
  };
}

export interface KubernetesClusterConfig {
  name: string;
  url: string;
  authProvider: string;
  skipTLSVerify?: boolean;
  serviceAccountToken?: string;
  caData?: string;
}

export interface ResourceFilter {
  apiVersion?: string;
  kind?: string;
  namespace?: string;
  labelSelector?: Record<string, string>;
  annotationSelector?: Record<string, string>;
}

export interface XRDEntity {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
  };
  spec: {
    group: string;
    names: {
      kind: string;
      plural: string;
      singular?: string;
    };
    versions: Array<{
      name: string;
      served: boolean;
      storage: boolean;
      schema?: any;
    }>;
  };
}

export interface TransformedEntity {
  apiVersion: string;
  kind: string;
  metadata: Record<string, any>;
  spec: Record<string, any>;
}