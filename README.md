# Backstage Ingestor Plugin

A powerful Backstage backend plugin that automatically discovers and imports Kubernetes resources into the Backstage catalog. This plugin provides seamless integration between your Kubernetes clusters and Backstage, enabling automatic discovery of services, deployments, and custom resources.

Originally forked from [@terasky/backstage-plugin-kubernetes-ingestor](https://github.com/TeraSky-OSS/backstage-plugins), this plugin has been customized for the Open Service Portal project with enhanced features and simplified configuration.

## Features

- **Automatic Resource Discovery**: Continuously scans Kubernetes clusters for resources
- **Crossplane XRD Support**: Discovers and imports Crossplane Composite Resource Definitions as templates
- **Namespace Filtering**: Configurable inclusion/exclusion of namespaces
- **Multi-Cluster Support**: Works with multiple Kubernetes clusters simultaneously
- **Custom Resource Support**: Extensible to support any Kubernetes custom resource
- **Entity Metadata Enrichment**: Automatically adds relevant Kubernetes metadata to catalog entities
- **XRD Template Generation**: Automatically generates Backstage templates for Crossplane XRDs
- **GitOps Integration**: Support for PR-based template registration (GitHub/GitLab/Bitbucket)
- **CLI Tools**: Command-line tools for ingestion and export operations
- **Unified Architecture**: Same ingestion engine used by both CLI and runtime
- **XR Status Links**: Automatic extraction and generation of links from Kubernetes resource status fields

## Installation

### As a Local Plugin

Clone this repository into your Backstage app's plugins directory:

```bash
cd packages/backend/plugins
git clone https://github.com/open-service-portal/ingestor.git
```

### Package Installation

Add the plugin to your backend:

```bash
yarn add --cwd packages/backend @open-service-portal/backstage-plugin-ingestor
```

## Quick Start

### Basic Configuration

Add to your `app-config.yaml`:

```yaml
kubernetesIngestor:
  components:
    enabled: true
    excludedNamespaces:
      - kube-system
      - kube-public
  crossplane:
    enabled: true
    xrds:
      enabled: true
```

**[→ Full Configuration Reference](./docs/configuration.md)**

## Documentation

### For Users

- **[Configuration Reference](./docs/configuration.md)** - All configuration options with examples
- **[XR Status Links](./docs/xr-status-links.md)** - Automatic link extraction from status fields
- **[CLI: Ingestor](./docs/cli-ingestor.md)** - Process Kubernetes resources from files
- **[CLI: Export](./docs/cli-export.md)** - Export entities from Backstage catalog

### For Developers

- **[Architecture Overview](./docs/architecture.md)** - System design and components
- **[XRD Ingestion](./docs/xrd-ingestion.md)** - How XRDs are transformed to templates
- **[CLI Implementation](./docs/cli-implementation.md)** - CLI tools architecture
- **[Testing Guide](./tests/README.md)** - Running and writing tests

## Backend Integration

Add the plugin to your backend in `packages/backend/src/index.ts`:

```typescript
import { catalogModuleIngestor } from '@open-service-portal/backstage-plugin-ingestor';

// In your backend builder
backend.add(catalogModuleIngestor());
```

## Kubernetes RBAC Requirements

The service account used by Backstage needs appropriate permissions. See [K8S_RBAC.md](./K8S_RBAC.md) for detailed RBAC configuration.

## Architecture

The plugin consists of several key components:

- **Entity Providers**: Scan Kubernetes resources and convert them to Backstage entities
- **Resource Fetchers**: Handle communication with Kubernetes API
- **Entity Processors**: Transform Kubernetes resources into catalog entities
- **Annotation Handlers**: Manage entity relationships and metadata
- **Template Generators**: Create Backstage templates from XRDs

For detailed architecture information, see [docs/architecture.md](./docs/architecture.md).

## Key Features Documentation

### XR Status Links

The ingestor automatically extracts and generates navigation links from Kubernetes resource status fields. This feature is particularly valuable for Crossplane XRs where compositions populate status with URLs, endpoints, and connection information.

**[→ Full XR Status Links Documentation](./docs/xr-status-links.md)**

- Supported status fields and formats
- Implementation details and architecture
- Configuration and customization
- Examples and best practices

## CLI Tools

The plugin includes two command-line tools that use the same ingestion engine as the runtime plugin:

### Ingestor CLI

Process Kubernetes resources from files without running Backstage:

```bash
# Process XRD file
npx ts-node src/cli/ingestor-cli.ts xrd.yaml

# Preview generated template
npx ts-node src/cli/ingestor-cli.ts xrd.yaml --preview

# Process with custom tags
npx ts-node src/cli/ingestor-cli.ts xrd.yaml --tags "database,production"
```

**[→ Full Ingestor CLI Documentation](./docs/cli-ingestor.md)**

### Export CLI

Extract entities from a running Backstage catalog:

```bash
# Export all templates
npx ts-node src/cli/backstage-export.ts --kind Template

# Export with filtering
npx ts-node src/cli/backstage-export.ts --kind Component --owner platform-team

# Preview what would be exported
npx ts-node src/cli/backstage-export.ts --kind Template --preview
```

**[→ Full Export CLI Documentation](./docs/cli-export.md)**

## Development

### Prerequisites

- Node.js 18+
- Yarn 3.x
- Access to a Kubernetes cluster
- Backstage development environment

### Setup

```bash
# Install dependencies
yarn install

# Build the plugin
yarn build

# Build CLI tools
yarn build:cli

# Run tests
yarn test

# Start in development mode
yarn start
```

### Testing CLI Tools

```bash
# Test ingestor CLI locally
yarn cli:ingestor examples/xrd.yaml --preview

# Test export CLI locally
yarn cli:export --list --kind Template
```

### Testing with Local Backstage

1. Link the plugin in your Backstage app:
```bash
cd packages/backend
yarn link @open-service-portal/backstage-plugin-ingestor
```

2. Start Backstage in development mode:
```bash
yarn dev
```

## Migration from TeraSky Plugin

If you're migrating from the original TeraSky plugin:

1. Update your import statements:
```typescript
// Before
import { catalogModuleKubernetesIngestor } from '@terasky/backstage-plugin-kubernetes-ingestor';

// After
import { catalogModuleIngestor } from '@open-service-portal/backstage-plugin-ingestor';
```

2. Update your configuration keys if needed (most remain compatible)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Key Areas for Contribution

- Additional Kubernetes resource types
- Enhanced filtering capabilities
- Performance optimizations
- Documentation improvements

## Support

- [GitHub Issues](https://github.com/open-service-portal/ingestor/issues)
- [Documentation](https://github.com/open-service-portal/ingestor/wiki)
- [Open Service Portal Discussions](https://github.com/open-service-portal/discussions)

## Credits

This plugin is based on the excellent work by [TeraSky](https://github.com/TeraSky-OSS) on their [kubernetes-ingestor plugin](https://terasky-oss.github.io/backstage-plugins/plugins/kubernetes-ingestor/overview).

## License

Apache 2.0 - See [LICENSE](LICENSE) for details.