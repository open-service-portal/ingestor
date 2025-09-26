export interface KubernetesProxyRequestBody {
  path: string;
}

export interface KubernetesResourceFetcherOptions {
  clusterName: string;
  namespace?: string;
  resourcePath: string;
  query?: Record<string, string>;
}

export interface KubernetesResourceFetcher {
  getClusters(): Promise<string[]>;
  fetchResources<T>(options: KubernetesResourceFetcherOptions): Promise<T[]>;
  fetchResource<T>(options: KubernetesResourceFetcherOptions): Promise<T>;
  proxyKubernetesRequest(
    clusterName: string,
    request: KubernetesProxyRequestBody,
  ): Promise<any>;
}
