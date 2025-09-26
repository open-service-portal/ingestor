# Ingestor Plugin Configuration Reference

This document provides a comprehensive reference for all configuration options available in the Backstage Ingestor Plugin.

## Table of Contents

- [Overview](#overview)
- [Configuration Structure](#configuration-structure)
- [Mappings Configuration](#mappings-configuration)
- [Components Configuration](#components-configuration)
- [Crossplane Configuration](#crossplane-configuration)
- [Advanced Options](#advanced-options)
- [Examples](#examples)

## Overview

The ingestor plugin is configured through your `app-config.yaml` file under the `kubernetesIngestor` key. All configuration options are optional with sensible defaults.

```yaml
kubernetesIngestor:
  mappings: { ... }      # Entity mapping configuration
  components: { ... }    # Kubernetes component discovery
  crossplane: { ... }    # Crossplane XRD discovery
```

## Configuration Structure

### Complete Configuration Example

```yaml
kubernetesIngestor:
  # Annotation prefix for custom annotations
  annotationPrefix: 'terasky.backstage.io'  # default: 'terasky.backstage.io'

  # Filter which clusters to ingest from
  allowedClusterNames:                       # optional, defaults to all clusters
    - production
    - staging

  # Entity mapping configuration
  mappings:
    namespaceModel: 'namespace'              # Options: cluster, namespace, default
    nameModel: 'name-cluster'                 # Options: name-cluster, name-namespace, name
    titleModel: 'name'                        # Options: name, name-cluster, name-namespace
    systemModel: 'cluster'                    # Options: cluster, namespace, cluster-namespace, default
    referencesNamespaceModel: 'default'      # Options: same, default

  # Kubernetes component discovery
  components:
    enabled: true                             # Enable component discovery
    taskRunner:
      frequency: 600                          # Scan frequency in seconds (default: 600)
      timeout: 600                            # Maximum processing time in seconds (default: 600)
    excludedNamespaces:                       # Namespaces to exclude from discovery
      - kube-public
      - kube-system
      - kube-node-lease
    onlyIngestAnnotatedResources: false      # Only ingest resources with backstage annotations

  # Crossplane configuration
  crossplane:
    enabled: true                             # Enable Crossplane support
    claims:
      ingestAllClaims: true                   # Ingest all claims and XRs from cluster
    xrds:
      enabled: true                           # Enable XRD discovery
      ingestAllXRDs: true                     # Ingest all XRDs with the label
      labelSelector: 'openportal.dev/tags'    # Label selector for XRDs
      tagsLabel: 'openportal.dev/tags'        # Label containing tags for templates
      defaultNamespace: 'demo'                # Default namespace for XR templates
      taskRunner:
        frequency: 600                        # XRD scan frequency in seconds
        timeout: 600                          # Maximum XRD processing time in seconds

  # Generic CRD templates configuration (advanced)
  genericCRDTemplates:
    publishPhase:
      target: 'github'                        # Target git provider: github, gitlab, bitbucket
      allowedTargets:                         # Allowed targets for template selection
        - github
        - gitlab
      allowRepoSelection: true                # Allow repository selection in templates
      git:
        repoUrl: 'github.com?repo=catalog-orders&owner=open-service-portal'
        targetBranch: 'main'
```

## Mappings Configuration

The mappings section controls how Kubernetes resources are mapped to Backstage entities.

### `namespaceModel`

Controls how the namespace is represented in entity metadata.

- **Type:** `string`
- **Default:** `'default'`
- **Options:**
  - `'cluster'` - Use the cluster name as namespace
  - `'namespace'` - Use the Kubernetes namespace
  - `'default'` - Always use 'default'

### `nameModel`

**Note:** This configuration option is defined but not currently implemented in the code.

- **Type:** `string`
- **Default:** `'name-cluster'`
- **Options:**
  - `'name-cluster'` - Format: `{name}-{cluster}`
  - `'name-namespace'` - Format: `{name}-{namespace}`
  - `'name'` - Use resource name only

### `titleModel`

**Note:** This configuration option is defined but not currently implemented in the code.

- **Type:** `string`
- **Default:** `'name'`
- **Options:**
  - `'name'` - Use resource name
  - `'name-cluster'` - Format: `{name} ({cluster})`
  - `'name-namespace'` - Format: `{name} ({namespace})`

### `systemModel`

Determines which system entities are associated with.

- **Type:** `string`
- **Default:** `'namespace'`
- **Options:**
  - `'cluster'` - Group by cluster
  - `'namespace'` - Group by namespace
  - `'cluster-namespace'` - Format: `{cluster}-{namespace}`
  - `'default'` - Use 'default' system

### `referencesNamespaceModel`

Controls namespace references in entity relationships.

- **Type:** `string`
- **Default:** `'default'`
- **Options:**
  - `'same'` - Use the same namespace as the resource
  - `'default'` - Always use 'default'

## Components Configuration

Controls the discovery and ingestion of Kubernetes components (Deployments, Services, etc.).

### `enabled`

Enable or disable component discovery.

- **Type:** `boolean`
- **Default:** `true`

### `taskRunner`

Configures the scheduled task that scans for components.

#### `taskRunner.frequency`

How often to scan clusters for components.

- **Type:** `number` (seconds)
- **Default:** `600` (10 minutes)
- **Range:** 10 - 86400 (10 seconds to 24 hours)

#### `taskRunner.timeout`

Maximum time allowed for component processing.

- **Type:** `number` (seconds)
- **Default:** `600` (10 minutes)
- **Range:** 60 - 3600 (1 minute to 1 hour)

### `excludedNamespaces`

List of namespaces to exclude from component discovery.

- **Type:** `string[]`
- **Default:** `[]`
- **Recommended:**
  ```yaml
  excludedNamespaces:
    - kube-public
    - kube-system
    - kube-node-lease
    - flux-system
    - crossplane-system
    - cert-manager
    - ingress-nginx
  ```

### `onlyIngestAnnotatedResources`

Only ingest resources that have Backstage annotations.

- **Type:** `boolean`
- **Default:** `false`
- **Use Case:** Set to `true` in large clusters to only discover explicitly annotated resources

## Crossplane Configuration

Controls the discovery and ingestion of Crossplane resources.

### `enabled`

Enable or disable Crossplane support globally.

- **Type:** `boolean`
- **Default:** `true`

### Claims Configuration

#### `claims.ingestAllClaims`

Automatically discover and ingest all Crossplane claims and XRs.

- **Type:** `boolean`
- **Default:** `true`
- **Note:** When `false`, only explicitly annotated claims are ingested

### XRDs Configuration

#### `xrds.enabled`

Enable XRD discovery and template generation.

- **Type:** `boolean`
- **Default:** `true`

#### `xrds.ingestAllXRDs`

Ingest all XRDs that match the label selector.

- **Type:** `boolean`
- **Default:** `true`
- **Note:** When `false`, only XRDs with specific annotations are processed

#### `xrds.labelSelector`

Kubernetes label selector for filtering XRDs.

- **Type:** `string`
- **Default:** `'openportal.dev/tags'`
- **Example:** Only process XRDs with this label present

#### `xrds.tagsLabel`

Label key containing comma-separated tags for templates.

- **Type:** `string`
- **Default:** `'openportal.dev/tags'`
- **Usage:** Tags from this label are added to generated templates

#### `xrds.defaultNamespace`

Default namespace for XR instances created from templates.

- **Type:** `string`
- **Default:** `'demo'`

#### `xrds.taskRunner`

Separate task runner configuration for XRD discovery.

- **`frequency`**: Scan interval in seconds (default: 600)
- **`timeout`**: Maximum processing time in seconds (default: 600)

## Advanced Options

### `annotationPrefix`

Customize the annotation prefix used for Backstage-specific annotations.

- **Type:** `string`
- **Default:** `'terasky.backstage.io'`
- **Example:** With prefix `'mycompany.io'`, annotations would be:
  - `mycompany.io/kubernetes-id`
  - `mycompany.io/source-location`

### `allowedClusterNames`

Filter which clusters to ingest resources from.

- **Type:** `string[]`
- **Default:** `undefined` (all clusters)
- **Example:**
  ```yaml
  allowedClusterNames:
    - production
    - staging
  ```

### Generic CRD Templates

Advanced configuration for template generation and GitOps integration.

#### `genericCRDTemplates.publishPhase.target`

Default git provider for template publishing.

- **Type:** `string`
- **Options:** `'github'`, `'gitlab'`, `'bitbucket'`
- **Default:** `'github'`

#### `genericCRDTemplates.publishPhase.allowedTargets`

Which git providers users can select in templates.

- **Type:** `string[]`
- **Default:** `['github']`

#### `genericCRDTemplates.publishPhase.allowRepoSelection`

Allow users to select different repositories in template forms.

- **Type:** `boolean`
- **Default:** `true`

#### `genericCRDTemplates.publishPhase.git`

Default git configuration for template publishing.

- **`repoUrl`**: Repository URL with placeholders
- **`targetBranch`**: Default branch for PRs/commits

## Examples

### Minimal Configuration

```yaml
kubernetesIngestor:
  components:
    enabled: true
  crossplane:
    enabled: true
```

### Production Configuration

```yaml
kubernetesIngestor:
  allowedClusterNames:
    - production
    - staging

  mappings:
    namespaceModel: 'namespace'
    systemModel: 'cluster-namespace'

  components:
    enabled: true
    taskRunner:
      frequency: 300  # 5 minutes
      timeout: 900    # 15 minutes
    excludedNamespaces:
      - kube-public
      - kube-system
      - kube-node-lease
      - flux-system
      - crossplane-system
      - backstage-system
      - cert-manager
      - ingress-nginx
      - external-dns
    onlyIngestAnnotatedResources: true

  crossplane:
    enabled: true
    claims:
      ingestAllClaims: true
    xrds:
      enabled: true
      ingestAllXRDs: true
      labelSelector: 'platform.company.com/backstage'
      tagsLabel: 'platform.company.com/tags'
      defaultNamespace: 'platform-services'
      taskRunner:
        frequency: 600
        timeout: 1200
```

### Multi-Cluster Configuration

```yaml
kubernetesIngestor:
  allowedClusterNames:
    - us-east-1
    - us-west-2
    - eu-central-1

  mappings:
    namespaceModel: 'cluster'
    systemModel: 'cluster'

  components:
    enabled: true
    excludedNamespaces:
      - kube-system
      - kube-public
```

### Development Configuration

```yaml
kubernetesIngestor:
  annotationPrefix: 'dev.backstage.io'

  mappings:
    namespaceModel: 'namespace'
    systemModel: 'namespace'

  components:
    enabled: true
    taskRunner:
      frequency: 60    # 1 minute for faster feedback
      timeout: 300     # 5 minutes
    excludedNamespaces:
      - kube-system

  crossplane:
    enabled: true
    xrds:
      enabled: true
      defaultNamespace: 'dev-test'
```

## Environment Variables

Some configuration values can be overridden using environment variables:

- `INGESTOR_ANNOTATION_PREFIX` - Override `annotationPrefix`
- `INGESTOR_SCAN_FREQUENCY` - Override `taskRunner.frequency` (in seconds)
- `INGESTOR_EXCLUDED_NAMESPACES` - Comma-separated list of namespaces to exclude

## Troubleshooting

### Components Not Being Discovered

1. Check that `components.enabled` is `true`
2. Verify the namespace is not in `excludedNamespaces`
3. If `onlyIngestAnnotatedResources` is `true`, ensure resources have annotations
4. Check logs for errors: `kubectl logs -n backstage deployment/backstage -c backstage`

### XRDs Not Generating Templates

1. Ensure `crossplane.xrds.enabled` is `true`
2. Verify XRDs have the required label (default: `openportal.dev/tags`)
3. Check that the label contains valid tags
4. Review logs for XRD processing errors

### High Memory Usage

Reduce scan frequency or increase timeout:
```yaml
components:
  taskRunner:
    frequency: 1800  # 30 minutes
    timeout: 1800    # 30 minutes
```

### Slow Ingestion

1. Increase `taskRunner.timeout`
2. Use `allowedClusterNames` to limit clusters
3. Add more namespaces to `excludedNamespaces`
4. Enable `onlyIngestAnnotatedResources` for large clusters