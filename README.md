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

## Configuration

Add the ingestor configuration to your `app-config.yaml`:

```yaml
catalog:
  providers:
    kubernetes:
      enabled: true
      schedule:
        frequency: { minutes: 5 }
        timeout: { minutes: 2 }
      clusters:
        - name: production
          authProvider: serviceAccount
          skipTLSVerify: false
          namespaces:
            include: ['default', 'production-*']
            exclude: ['kube-system', 'kube-public']

    crossplane:
      enabled: true
      schedule:
        frequency: { minutes: 10 }
      clusters:
        - name: production
          templateGeneration:
            enabled: true
            gitProvider: github
            repository: open-service-portal/catalog-orders
```

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

## CLI Tools

This plugin includes command-line tools for ingestion and export operations. The CLI uses the same ingestion engine as the runtime plugin, ensuring consistent behavior.

### Ingestor CLI

The ingestor CLI allows you to ingest Kubernetes resources from files or directories without running Backstage.

```bash
# Install globally
npm install -g @open-service-portal/backstage-plugin-ingestor

# Or use locally
yarn cli:ingestor --help
```

#### Usage

```bash
# Ingest from a single file
ingestor xrd.yaml

# Ingest from a directory
ingestor ./resources

# Ingest from stdin
cat xrd.yaml | ingestor -

# Preview what would be generated
ingestor xrd.yaml --preview

# Validate resources only
ingestor xrd.yaml --validate

# Customize output
ingestor xrd.yaml --output ./catalog --format json --owner platform-team
```

#### Options

- `-o, --output <dir>` - Output directory (default: ./catalog-entities)
- `-f, --format <format>` - Output format: yaml or json (default: yaml)
- `--owner <owner>` - Set entity owner
- `--namespace <namespace>` - Set entity namespace
- `--tags <tags>` - Add tags (comma-separated)
- `-v, --validate` - Validate resources without ingesting
- `-p, --preview` - Preview what would be generated
- `--strict` - Fail on validation warnings
- `--quiet` - Suppress non-error output
- `--verbose` - Show detailed information

### Export CLI

The export CLI extracts entities from a running Backstage catalog for backup, migration, or auditing.

```bash
# Install globally
npm install -g @open-service-portal/backstage-plugin-ingestor

# Or use locally
yarn cli:export --help
```

#### Usage

```bash
# Export all templates
backstage-export --kind Template

# Export with filters
backstage-export --kind Template --tags crossplane --output ./templates

# Export from specific Backstage instance
backstage-export --url https://backstage.example.com --token $TOKEN

# Preview export
backstage-export --preview --kind Template,API

# List all APIs
backstage-export --list --kind API

# Export with manifest
backstage-export --kind Template --manifest --organize
```

#### Options

- `-u, --url <url>` - Backstage URL (default: http://localhost:7007)
- `-t, --token <token>` - API token (or use BACKSTAGE_TOKEN env)
- `-k, --kind <kinds>` - Entity kinds (comma-separated)
- `-n, --namespace <namespace>` - Namespace filter
- `--name <pattern>` - Name pattern (supports wildcards)
- `--owner <owner>` - Owner filter
- `--tags <tags>` - Tags filter (comma-separated)
- `-o, --output <dir>` - Output directory (default: ./exported)
- `-f, --format <format>` - Output format: yaml or json (default: yaml)
- `--organize` - Organize output by entity type
- `--manifest` - Generate export manifest file
- `-p, --preview` - Preview what would be exported
- `-l, --list` - List matching entities only
- `--quiet` - Suppress non-error output
- `--verbose` - Show detailed information

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