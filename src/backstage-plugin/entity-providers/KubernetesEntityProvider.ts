import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import { LoggerService, SchedulerServiceTaskRunner } from '@backstage/backend-plugin-api';
import { DefaultKubernetesResourceFetcher } from '../services';
import { KubernetesDataProvider } from '../providers/KubernetesDataProvider';
import { Logger } from 'winston';
import { XRDDataProvider } from '../providers/XRDDataProvider';
import pluralize from 'pluralize';
import { BackstageLink } from '../interfaces';
import { ComponentEntityBuilder } from '../entity-builders/ComponentEntityBuilder';
import { SystemEntityBuilder } from '../entity-builders/SystemEntityBuilder';

export class KubernetesEntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;

  constructor(
    private readonly taskRunner: SchedulerServiceTaskRunner,
    private readonly logger: LoggerService,
    private readonly config: Config,
    private readonly resourceFetcher: DefaultKubernetesResourceFetcher,
  ) {
    this.logger = {
      silent: true,
      format: undefined,
      levels: { error: 0, warn: 1, info: 2, debug: 3 },
      level: 'warn',
      error: logger.error.bind(logger),
      warn: logger.warn.bind(logger),
      info: logger.info.bind(logger),
      debug: logger.debug.bind(logger),
      transports: [],
      exceptions: { handle() {} },
      rejections: { handle() {} },
      profilers: {},
      exitOnError: false,
      log: (level: string, msg: string) => {
        switch (level) {
          case 'error': logger.error(msg); break;
          case 'warn': logger.warn(msg); break;
          case 'info': logger.info(msg); break;
          case 'debug': logger.debug(msg); break;
          default: logger.info(msg);
        }
      },
    } as unknown as Logger;
  }

  private validateEntityName(entity: Entity): boolean {
    if (entity.metadata.name.length > 63) {
      this.logger.warn(
        `The entity ${entity.metadata.name} of type ${entity.kind} cant be ingested as its auto generated name would be over 63 characters long. please consider chaning the naming conventions via the config of the plugin or shorten the names in the relevant sources of info to allow this resource to be ingested.`
      );
      return false;
    }
    return true;
  }

  getProviderName(): string {
    return 'KubernetesEntityProvider';
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    await this.taskRunner.run({
      id: this.getProviderName(),
      fn: async () => {
        await this.run();
      },
    });
  }

  async run(): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    try {
      const isCrossplaneEnabled = this.config.getOptionalBoolean('kubernetesIngestor.crossplane.enabled') ?? true;

      if (this.config.getOptionalBoolean('kubernetesIngestor.components.enabled')) {
        // Initialize providers
        const kubernetesDataProvider = new KubernetesDataProvider(
          this.resourceFetcher,
          this.config,
          this.logger,
        );

        let compositeKindLookup: { [key: string]: any } = {};
        let xrdDataProvider;

        // Only initialize Crossplane providers if enabled
        if (isCrossplaneEnabled) {
          xrdDataProvider = new XRDDataProvider(
            this.resourceFetcher,
            this.config,
            this.logger,
          );
          // Build composite kind lookup for v2/Cluster/Namespaced (case-insensitive)
          compositeKindLookup = await xrdDataProvider.buildCompositeKindLookup();
          // Add lowercased keys for case-insensitive matching
          for (const key of Object.keys(compositeKindLookup)) {
            compositeKindLookup[key.toLowerCase()] = compositeKindLookup[key];
          }
        }

        // Fetch all Kubernetes resources and build a CRD mapping
        const kubernetesData = await kubernetesDataProvider.fetchKubernetesObjects();
        const crdMapping = await kubernetesDataProvider.fetchCRDMapping();
        let claimCount = 0, compositeCount = 0, k8sCount = 0;
        const entities = kubernetesData.flatMap((k8s: any) => {
          if (!isCrossplaneEnabled) {
            // When Crossplane is disabled, treat everything as regular K8s resources
            if (k8s) {
              // Log the resource type being processed
              this.logger.debug(`Processing as regular K8s resource: ${k8s.kind} ${k8s.metadata?.name}`);
              k8sCount++;
              return this.translateKubernetesObjectsToEntities(k8s);
            }
            return [];
          }

          // Crossplane processing when enabled
          if (k8s?.spec?.resourceRef) {
            this.logger.debug(`Processing Crossplane claim: ${k8s.kind} ${k8s.metadata?.name}`);
            const entity = this.translateCrossplaneClaimToEntity(k8s, k8s.clusterName, crdMapping);
            if (entity) claimCount++;
            return entity ? [entity] : [];
          }
          // Ingest XRs for v2/Cluster or v2/Namespaced (case-insensitive)
          if (k8s?.spec?.crossplane) {
            this.logger.debug(`Processing Crossplane XR: ${k8s.kind} ${k8s.metadata?.name}`);
            const [group, version] = k8s.apiVersion.split('/');
            const lookupKey = `${k8s.kind}|${group}|${version}`;
            const lookupKeyLower = lookupKey.toLowerCase();
            if (compositeKindLookup[lookupKey] || compositeKindLookup[lookupKeyLower]) {
              const entity = this.translateCrossplaneCompositeToEntity(k8s, k8s.clusterName, compositeKindLookup);
              if (entity) compositeCount++;
              return entity ? [entity] : [];
            }
          }
          // Fallback: treat as regular K8s resource
          if (k8s) {
            this.logger.debug(`Processing as regular K8s resource: ${k8s.kind} ${k8s.metadata?.name}`);
            k8sCount++;
            return this.translateKubernetesObjectsToEntities(k8s);
          }
          return [];
        });

        await this.connection.applyMutation({
          type: 'full',
          entities: entities.map((entity: Entity) => ({
            entity,
            locationKey: `provider:${this.getProviderName()}`,
          })),
        });
      }
    } catch (error) {
      this.logger.error(`Failed to run KubernetesEntityProvider: ${error}`);
    }
  }

  private translateKubernetesObjectsToEntities(resource: any): Entity[] {
    const namespace = resource.metadata.namespace || 'default';
    const annotations = resource.metadata.annotations || {};
    const systemNamespaceModel = this.config.getOptionalString('kubernetesIngestor.mappings.namespaceModel')?.toLowerCase() || 'default';
    let systemNamespaceValue = '';
    if (systemNamespaceModel === 'cluster') {
      systemNamespaceValue = resource.clusterName;
    } else if (systemNamespaceModel === 'namespace') {
      systemNamespaceValue = namespace || 'default';
    } else {
      systemNamespaceValue = 'default';
    }
    const systemNameModel = this.config.getOptionalString('kubernetesIngestor.mappings.systemModel')?.toLowerCase() || 'namespace';
    let systemNameValue = '';
    if (systemNameModel === 'cluster') {
      systemNameValue = resource.clusterName;
    } else if (systemNameModel === 'namespace') {
      systemNameValue = namespace || resource.metadata.name;
    } else if (systemNameModel === 'cluster-namespace') {
      if (resource.metadata.namespace) {
        systemNameValue = `${resource.clusterName}-${resource.metadata.namespace}`;
      } else {
        systemNameValue = `${resource.clusterName}`;
      }
    } else {
      systemNameValue = 'default';
    }
    const systemReferencesNamespaceModel = this.config.getOptionalString('kubernetesIngestor.mappings.referencesNamespaceModel')?.toLowerCase() || 'default';
    let systemReferencesNamespaceValue = '';
    if (systemReferencesNamespaceModel === 'same') {
      systemReferencesNamespaceValue = resource.metadata.name;
    } else if (systemReferencesNamespaceModel === 'default') {
      systemReferencesNamespaceValue = 'default';
    }
    const prefix = this.getAnnotationPrefix();

    const customAnnotations = this.extractCustomAnnotations(annotations, resource.clusterName);

    // Add the Kubernetes label selector annotation if present
    if (!annotations[`${prefix}/kubernetes-label-selector`]) {
      if (resource.kind === 'Deployment' || resource.kind === 'StatefulSet' || resource.kind === 'DaemonSet' || resource.kind === 'CronJob') {
        const commonLabels = this.findCommonLabels(resource);
        if (commonLabels) {
          customAnnotations['backstage.io/kubernetes-label-selector'] = commonLabels;
        }
      }
    } else {
      customAnnotations['backstage.io/kubernetes-label-selector'] = annotations[`${prefix}/kubernetes-label-selector`];
    }

    // Add custom workload URI
    if (resource.apiVersion) {
      const [apiGroup, version] = resource.apiVersion.includes('/')
        ? resource.apiVersion.split('/')
        : ['', resource.apiVersion];
      const kindPlural = pluralize(resource.kind);
      const objectName = resource.metadata.name;
      const customWorkloadUri = resource.metadata.namespace
        ? `/apis/${apiGroup}/${version}/namespaces/${namespace}/${kindPlural}/${objectName}`
        : `/apis/${apiGroup}/${version}/${kindPlural}/${objectName}`;
      customAnnotations[`${prefix}/custom-workload-uri`] = customWorkloadUri.toLowerCase();
    }

    // Add source-location and techdocs-ref if present
    if (annotations[`${prefix}/source-code-repo-url`]) {
      const repoUrl = `url:${annotations[`${prefix}/source-code-repo-url`]}`;
      customAnnotations['backstage.io/source-location'] = repoUrl;

      // Construct techdocs-ref
      const branch = annotations[`${prefix}/source-branch`] || 'main';
      const techdocsPath = annotations[`${prefix}/techdocs-path`];

      if (techdocsPath) {
        customAnnotations['backstage.io/techdocs-ref'] = `${repoUrl}/blob/${branch}/${techdocsPath}`;
      }
    }

    // Create system entity using SystemEntityBuilder
    const systemEntity = new SystemEntityBuilder()
      .withKubernetesSystemMetadata(
        resource,
        systemNameValue,
        systemNamespaceValue,
        systemReferencesNamespaceValue,
        prefix,
        customAnnotations
      )
      .build();

    // Create component entity using ComponentEntityBuilder
    const componentEntity = new ComponentEntityBuilder()
      .withKubernetesMetadata(
        resource,
        resource.clusterName,
        systemNamespaceValue,
        systemNameValue,
        systemReferencesNamespaceValue,
        prefix
      )
      .withLinks(this.parseBackstageLinks(resource.metadata.annotations || {}))
      .withAnnotations({
        ...Object.fromEntries(
          Object.entries(annotations).filter(([key]) => key !== `${prefix}/links`)
        ),
        'openportal.dev/kubernetes-kind': resource.kind,
        'openportal.dev/kubernetes-name': resource.metadata.name,
        'openportal.dev/kubernetes-api-version': resource.apiVersion,
        'openportal.dev/kubernetes-namespace': resource.metadata.namespace || '',
        ...customAnnotations,
        ...(systemNameModel === 'cluster-namespace' || systemNamespaceModel === 'cluster' ? {
          'backstage.io/kubernetes-cluster': resource.clusterName,
        } : {})
      })
      .build();

    const entities: Entity[] = [];
    if (this.validateEntityName(systemEntity)) {
      entities.push(systemEntity);
    }
    if (this.validateEntityName(componentEntity)) {
      entities.push(componentEntity);
    }
    return entities;
  }

  private translateCrossplaneClaimToEntity(claim: any, clusterName: string, crdMapping: any): Entity | undefined {
    // First, check if this is a valid claim by looking up its kind in the CRD mapping
    const resourceKind = claim.kind;
    if (!crdMapping[resourceKind]) {
      this.logger.debug(`No CRD mapping found for kind ${resourceKind}, skipping claim processing`);
      return undefined;
    }
    const prefix = this.getAnnotationPrefix();
    const annotations = claim.metadata.annotations || {};

    // Extract CR values
    const [crGroup, crVersion] = claim.apiVersion.split('/');
    const crKind = claim.kind;
    const crPlural = crdMapping[crKind] || pluralize(claim.kind.toLowerCase()); // Fetch plural from CRD mapping

    // Extract Composite values from `spec.resourceRef`
    const compositeRef = claim.spec?.resourceRef || {};
    const compositeKind = compositeRef.kind || '';
    const compositeName = compositeRef.name || '';
    const compositeGroup = compositeRef.apiVersion?.split('/')?.[0] || '';
    const compositeVersion = compositeRef.apiVersion?.split('/')?.[1] || '';
    const compositePlural = compositeKind ? crdMapping[compositeKind] || '' : ''; // Fetch plural for composite kind
    const compositionData = claim.compositionData || {};
    const compositionName = compositionData.name || '';
    const compositionFunctions = compositionData.usedFunctions || [];

    // Add Crossplane claim annotations
    const crossplaneAnnotations = {
      [`${prefix}/claim-name`]: claim.metadata.name,
      [`${prefix}/claim-kind`]: crKind,
      [`${prefix}/claim-version`]: crVersion,
      [`${prefix}/claim-group`]: crGroup,
      [`${prefix}/claim-plural`]: crPlural,
      [`${prefix}/crossplane-resource`]: "true",
      [`${prefix}/composite-kind`]: compositeKind,
      [`${prefix}/composite-name`]: compositeName,
      [`${prefix}/composite-group`]: compositeGroup,
      [`${prefix}/composite-version`]: compositeVersion,
      [`${prefix}/composite-plural`]: compositePlural,
      [`${prefix}/composition-name`]: compositionName,
      [`${prefix}/composition-functions`]: compositionFunctions.join(','),
      'backstage.io/kubernetes-label-selector': `crossplane.io/claim-name=${claim.metadata.name},crossplane.io/claim-namespace=${claim.metadata.namespace},crossplane.io/composite=${compositeName}`
    };

    const resourceAnnotations = claim.metadata.annotations || {};
    const customAnnotations = this.extractCustomAnnotations(resourceAnnotations, clusterName);

    const systemNamespaceModel = this.config.getOptionalString('kubernetesIngestor.mappings.namespaceModel')?.toLowerCase() || 'default';
    let systemNamespaceValue = '';
    if (systemNamespaceModel === 'cluster') {
      systemNamespaceValue = clusterName;
    } else if (systemNamespaceModel === 'namespace') {
      systemNamespaceValue = claim.metadata.namespace || 'default';
    } else {
      systemNamespaceValue = 'default';
    }
    const systemNameModel = this.config.getOptionalString('kubernetesIngestor.mappings.systemModel')?.toLowerCase() || 'namespace';
    let systemNameValue = '';
    if (systemNameModel === 'cluster') {
      systemNameValue = clusterName;
    } else if (systemNameModel === 'namespace') {
      systemNameValue = claim.metadata.namespace || claim.metadata.name;
    } else if (systemNameModel === 'cluster-namespace') {
      if (claim.metadata.namespace) {
        systemNameValue = `${clusterName}-${claim.metadata.namespace}`;
      } else {
        systemNameValue = `${clusterName}`;
      }
    } else {
      systemNameValue = 'default';
    }
    const systemReferencesNamespaceModel = this.config.getOptionalString('kubernetesIngestor.mappings.referencesNamespaceModel')?.toLowerCase() || 'default';
    let systemReferencesNamespaceValue = '';
    if (systemReferencesNamespaceModel === 'same') {
      systemReferencesNamespaceValue = claim.metadata.name;
    } else if (systemReferencesNamespaceModel === 'default') {
      systemReferencesNamespaceValue = 'default';
    }

    // Create component entity using ComponentEntityBuilder with Crossplane claim metadata
    const entity = new ComponentEntityBuilder()
      .withCrossplaneClaimMetadata(
        claim,
        clusterName,
        systemNamespaceValue,
        systemNameValue,
        systemReferencesNamespaceValue,
        prefix
      )
      .withLinks(this.parseBackstageLinks(claim.metadata.annotations || {}))
      .withAnnotations({
        ...Object.fromEntries(
          Object.entries(annotations).filter(([key]) => key !== `${prefix}/links`)
        ),
        [`${prefix}/component-type`]: 'crossplane-claim',
        ...(systemNameModel === 'cluster-namespace' || systemNamespaceModel === 'cluster' ? {
          'backstage.io/kubernetes-cluster': clusterName,
        } : {}),
        ...customAnnotations,
        ...crossplaneAnnotations,
      })
      .build();

    return this.validateEntityName(entity) ? entity : undefined;
  }

  private translateCrossplaneCompositeToEntity(xr: any, clusterName: string, compositeKindLookup: any): Entity | undefined {
    // First, check if this is a valid composite by looking up its kind in the composite kind lookup
    const [group, version] = xr.apiVersion.split('/');
    const lookupKey = `${xr.kind}|${group}|${version}`;
    const lookupKeyLower = lookupKey.toLowerCase();
    if (!compositeKindLookup[lookupKey] && !compositeKindLookup[lookupKeyLower]) {
      this.logger.debug(`No composite kind lookup found for key ${lookupKey}, skipping composite processing`);
      return undefined;
    }
    const annotations = xr.metadata.annotations || {};
    const prefix = this.getAnnotationPrefix();
    const kind = xr.kind;
    const scope = compositeKindLookup[lookupKey]?.scope || compositeKindLookup[lookupKeyLower]?.scope;
    const crossplaneVersion = 'v2';
    const plural = compositeKindLookup[lookupKey]?.spec?.names?.plural || compositeKindLookup[lookupKeyLower]?.spec?.names?.plural;
    const compositionName = xr.spec?.crossplane?.compositionRef?.name || '';
    const compositionData = xr.compositionData || {};
    const compositionFunctions = compositionData.usedFunctions || [];

    // Add Crossplane annotations
    const crossplaneAnnotations = {
      [`${prefix}/crossplane-version`]: crossplaneVersion,
      [`${prefix}/crossplane-scope`]: scope,
      [`${prefix}/composite-kind`]: kind,
      [`${prefix}/composite-name`]: xr.metadata.name,
      [`${prefix}/composite-group`]: group,
      [`${prefix}/composite-version`]: version,
      [`${prefix}/composite-plural`]: plural,
      [`${prefix}/composition-name`]: compositionName,
      [`${prefix}/crossplane-resource`]: 'true',
      [`${prefix}/component-type`]: 'crossplane-xr',
      'backstage.io/kubernetes-label-selector': `crossplane.io/composite=${xr.metadata.name}`,
    };

    // Add composition-functions annotation if present
    if (compositionFunctions.length > 0) {
      crossplaneAnnotations[`${prefix}/composition-functions`] = compositionFunctions.join(',');
    }

    const resourceAnnotations = xr.metadata.annotations || {};
    const customAnnotations = this.extractCustomAnnotations(resourceAnnotations, clusterName);

    const systemNamespaceModel = this.config.getOptionalString('kubernetesIngestor.mappings.namespaceModel')?.toLowerCase() || 'default';
    let systemNamespaceValue = '';
    if (systemNamespaceModel === 'cluster') {
      systemNamespaceValue = clusterName;
    } else if (systemNamespaceModel === 'namespace') {
      systemNamespaceValue = xr.metadata.namespace || 'default';
    } else {
      systemNamespaceValue = 'default';
    }
    const systemNameModel = this.config.getOptionalString('kubernetesIngestor.mappings.systemModel')?.toLowerCase() || 'namespace';
    let systemNameValue = '';
    if (systemNameModel === 'cluster') {
      systemNameValue = clusterName;
    } else if (systemNameModel === 'namespace') {
      systemNameValue = xr.metadata.namespace || xr.metadata.name;
    } else if (systemNameModel === 'cluster-namespace') {
      if (xr.metadata.namespace) {
        systemNameValue = `${clusterName}-${xr.metadata.namespace}`;
      } else {
        systemNameValue = `${clusterName}`;
      }
    } else {
      systemNameValue = 'default';
    }
    const systemReferencesNamespaceModel = this.config.getOptionalString('kubernetesIngestor.mappings.referencesNamespaceModel')?.toLowerCase() || 'default';
    let systemReferencesNamespaceValue = '';
    if (systemReferencesNamespaceModel === 'same') {
      systemReferencesNamespaceValue = xr.metadata.name;
    } else if (systemReferencesNamespaceModel === 'default') {
      systemReferencesNamespaceValue = 'default';
    }

    // Parse existing links from annotations and generate links from XR status
    const annotationLinks = this.parseBackstageLinks(xr.metadata.annotations || {});
    const statusLinks = this.generateLinksFromXRStatus(xr);

    // Merge both link sources, with annotation links taking precedence for duplicates
    const allLinks = [...annotationLinks, ...statusLinks];

    // Create component entity using ComponentEntityBuilder with Crossplane XR metadata
    const entity = new ComponentEntityBuilder()
      .withCrossplaneXRMetadata(
        xr,
        clusterName,
        systemNamespaceValue,
        systemNameValue,
        systemReferencesNamespaceValue,
        prefix
      )
      .withLinks(allLinks)
      .withAnnotations({
        ...Object.fromEntries(
          Object.entries(annotations).filter(([key]) => key !== `${prefix}/links`)
        ),
        'backstage.io/kubernetes-cluster': clusterName,
        ...customAnnotations,
        ...crossplaneAnnotations,
      })
      .build();

    return this.validateEntityName(entity) ? entity : undefined;
  }

  private extractCustomAnnotations(annotations: Record<string, string>, clusterName: string): Record<string, string> {
    const prefix = this.getAnnotationPrefix();
    const customAnnotations: Record<string, string> = {};
    for (const [key, value] of Object.entries(annotations)) {
      if (!key.startsWith(prefix)) {
        customAnnotations[key] = value;
      }
    }
    customAnnotations['backstage.io/managed-by-location'] = `cluster origin: ${clusterName}`;
    customAnnotations['backstage.io/managed-by-origin-location'] = `cluster origin: ${clusterName}`;
    return customAnnotations;
  }

  private getAnnotationPrefix(): string {
    return this.config.getOptionalString('kubernetesIngestor.annotationPrefix') || 'terasky.backstage.io';
  }

  private findCommonLabels(resource: any): string | null {
    const highLevelLabels = resource.metadata.labels || {};
    const podLabels = resource.spec?.template?.metadata?.labels || {};

    const commonLabels = Object.keys(highLevelLabels).filter(label => podLabels[label]);
    if (commonLabels.length > 0) {
      return commonLabels.map(label => `${label}=${highLevelLabels[label]}`).join(',');
    } else if (Object.keys(highLevelLabels).length > 0) {
      return Object.keys(highLevelLabels).map(label => `${label}=${highLevelLabels[label]}`).join(',');
    }

    return null;
  }

  private parseBackstageLinks(annotations: Record<string, string>): BackstageLink[] {
    const prefix = this.getAnnotationPrefix();
    const linksAnnotation = annotations[`${prefix}/links`];
    if (!linksAnnotation) {
      return [];
    }

    try {
      const linksArray = JSON.parse(linksAnnotation) as BackstageLink[];
      this.logger.debug(`Parsed ${prefix}/links: ${JSON.stringify(linksArray)}`);

      return linksArray.map((link: BackstageLink) => ({
        url: link.url,
        title: link.title,
        icon: link.icon
      }));
    } catch (error) {
      this.logger.warn(`Failed to parse ${prefix}/links annotation: ${error}`)
      this.logger.warn(`Raw annotation value: ${linksAnnotation}`)
      return [];
    }
  }

  /**
   * Generates links from XR status fields
   * Extracts URLs from common status patterns like domain, fqdn, url, endpoint, etc.
   */
  private generateLinksFromXRStatus(xr: any): BackstageLink[] {
    const links: BackstageLink[] = [];

    if (!xr.status) {
      return links;
    }

    // Check for domain field in status (common for services)
    if (xr.status.domain) {
      links.push({
        url: `https://${xr.status.domain}`,
        title: 'Service Domain',
        icon: 'WebAsset'
      });
    }

    // Check for FQDN field in status (DNS records)
    if (xr.status.fqdn) {
      // Create a Google DNS query link for FQDN
      links.push({
        url: `https://dns.google/query?name=${xr.status.fqdn}&type=ALL`,
        title: 'DNS Query (Google)',
        icon: 'DNS'
      });
    }

    // Check for url field in status
    if (xr.status.url) {
      links.push({
        url: xr.status.url,
        title: 'Service URL',
        icon: 'WebAsset'
      });
    }

    // Check for ingress host in status
    if (xr.status.ingress?.host) {
      links.push({
        url: `https://${xr.status.ingress.host}`,
        title: 'Ingress URL',
        icon: 'WebAsset'
      });
    }

    // Check for endpoint field in status
    if (xr.status.endpoint) {
      const endpoint = xr.status.endpoint;
      // Handle both string and object formats
      if (typeof endpoint === 'string') {
        links.push({
          url: endpoint.startsWith('http') ? endpoint : `https://${endpoint}`,
          title: 'Endpoint',
          icon: 'WebAsset'
        });
      } else if (endpoint.url) {
        links.push({
          url: endpoint.url,
          title: endpoint.title || 'Endpoint',
          icon: endpoint.icon || 'WebAsset'
        });
      }
    }

    // Check for endpoints array in status
    if (Array.isArray(xr.status.endpoints)) {
      xr.status.endpoints.forEach((ep: any, index: number) => {
        if (typeof ep === 'string') {
          links.push({
            url: ep.startsWith('http') ? ep : `https://${ep}`,
            title: `Endpoint ${index + 1}`,
            icon: 'WebAsset'
          });
        } else if (ep.url) {
          links.push({
            url: ep.url,
            title: ep.title || ep.name || `Endpoint ${index + 1}`,
            icon: ep.icon || 'WebAsset'
          });
        }
      });
    }

    // Check for urls array in status
    if (Array.isArray(xr.status.urls)) {
      xr.status.urls.forEach((url: any, index: number) => {
        if (typeof url === 'string') {
          links.push({
            url: url.startsWith('http') ? url : `https://${url}`,
            title: `URL ${index + 1}`,
            icon: 'WebAsset'
          });
        } else if (url.href || url.url) {
          links.push({
            url: url.href || url.url,
            title: url.title || url.name || `URL ${index + 1}`,
            icon: url.icon || 'WebAsset'
          });
        }
      });
    }

    // Check for address field in status (common for databases, services)
    if (xr.status.address) {
      const address = xr.status.address;
      // Only add if it looks like a URL or domain
      if (address.includes('.') || address.startsWith('http')) {
        links.push({
          url: address.startsWith('http') ? address : `https://${address}`,
          title: 'Service Address',
          icon: 'WebAsset'
        });
      }
    }

    // Check for hostname field in status
    if (xr.status.hostname) {
      links.push({
        url: `https://${xr.status.hostname}`,
        title: 'Service Hostname',
        icon: 'WebAsset'
      });
    }

    // Check for externalURL field in status (common for monitoring tools)
    if (xr.status.externalURL) {
      links.push({
        url: xr.status.externalURL,
        title: 'External URL',
        icon: 'WebAsset'
      });
    }

    return links;
  }
}