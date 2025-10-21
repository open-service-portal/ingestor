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
- **XRD Template Generation**: Automatically generates Backstage templates for Crossplane XRDs using Handlebars
- **Modular Template System**: Separate templates for parameters, steps, output, and API documentation
- **Multi-Template Composition**: Comma-separated template building blocks with YAML-aware merging
- **Template-Level Outputs**: Results panel in Backstage UI with download links and PR status
- **GitOps Integration**: Support for PR-based template registration (GitHub/GitLab/Bitbucket)
- **Context-Aware CLI**: Automatically detects kubectl context and loads cluster-specific configuration
- **CLI Tools**: Command-line tools for transformation, ingestion, and export operations
- **Unified Architecture**: Same ingestion engine used by both CLI and runtime
- **XR Status Links**: Automatic extraction and generation of links from Kubernetes resource status fields
- **Test Infrastructure**: Flattened scenario-based testing with 3+ passing tests

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
      # GitOps configuration for template generation
      gitops:
        ordersRepo:
          owner: 'your-org'
          repo: 'catalog-orders'
          targetBranch: 'main'
```

**[→ Full Configuration Reference](./docs/configuration.md)**

### GitOps Workflow

The plugin supports PR-based resource creation via the `gitops` step template:

- **Configuration**: Repository settings in `app-config.yaml` under `kubernetesIngestor.crossplane.xrds.gitops`
- **Auto-detection**: Automatically detects current kubectl context for cluster targeting
- **Validation**: Fails fast with helpful messages if configuration is missing
- **Template**: Use annotation `openportal.dev/template-steps: "gitops"` on your XRD

See [Template Development Guide](./templates/README.md) for details.

## Documentation

### For Users

- **[Quick Start Guide](./docs/quick-start.md)** - Get started quickly with copy-paste examples
- **[Configuration Reference](./docs/configuration.md)** - All configuration options with examples
- **[XRD Annotations Reference](./docs/xrd-annotations-reference.md)** - Control template generation with annotations
- **[XRD Transform Examples](./docs/xrd-transform-examples.md)** - Complete usage guide for xrd-transform tool
- **[XR Status Links](./docs/xr-status-links.md)** - Automatic link extraction from status fields
- **[CLI: Ingestor](./docs/cli-ingestor.md)** - Process Kubernetes resources from files
- **[CLI: Export](./docs/cli-export.md)** - Export entities from Backstage catalog

### For Developers

- **[Architecture Overview](./docs/architecture.md)** - System design and components
- **[XRD Ingestion](./docs/xrd-ingestion.md)** - How XRDs are transformed to templates
- **[Template Development Guide](./templates/README.md)** - Creating custom Handlebars templates
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

### Template Customization

The ingestor uses Handlebars templates to transform Crossplane XRDs into Backstage templates. You can customize these templates to match your organization's needs without forking the plugin.

**[→ Full Template Customization Guide](./docs/template-customization.md)**

- Initialize custom templates with `npx ingestor init`
- Configure template directory in `app-config.yaml`
- Customize templates for your organization
- Version control your customizations
- Safe npm package upgrades (don't overwrite customizations)

Quick start:
```bash
# Initialize custom templates
npx @open-service-portal/backstage-plugin-ingestor init

# Configure in app-config/ingestor.yaml
ingestor:
  crossplane:
    xrds:
      templateDir: './ingestor-templates'

# Customize templates
vim ingestor-templates/backstage/default.hbs
```

## CLI Tools

The plugin includes several command-line tools that use the same ingestion engine as the runtime plugin:

### Architecture: Bin Scripts + Shell Wrappers

The CLI tools use a dual-layer architecture:

1. **Bin Scripts** (`bin/ingestor`, `bin/backstage-export`)
   - npm-compatible entry points for package installation
   - Configure ts-node with `tsconfig.cli.json` for CommonJS module resolution
   - Can be used when plugin is installed as an npm package

2. **Shell Wrappers** (`scripts/*.sh`)
   - Handle path resolution and argument preprocessing
   - Provide user-friendly interfaces with auto-detection features
   - Delegate to bin scripts for execution

This architecture provides both npm installability and local development convenience.

### Template Initialization (Init Command)

Initialize custom templates for customization:

```bash
# Initialize templates in default location (./ingestor-templates)
npx @open-service-portal/backstage-plugin-ingestor init

# Or if using in Backstage app with yarn scripts
yarn ingestor:init

# With custom output directory
npx @open-service-portal/backstage-plugin-ingestor init --output my-templates

# Force overwrite existing templates
npx @open-service-portal/backstage-plugin-ingestor init --force
```

The init command:
- Copies all default templates from the npm package
- Creates complete directory structure (backstage/, parameters/, steps/, etc.)
- Provides next-step instructions for configuration
- Protects existing templates (requires --force to overwrite)

**[→ Full Template Customization Guide](./docs/template-customization.md)**

### XRD Transform Script (Template Ingestion)

Transform XRDs into Backstage templates:

```bash
# From plugin directory
./scripts/xrd-transform.sh path/to/xrd.yaml

# From workspace root (delegates to plugin script)
./scripts/template-ingest.sh template-namespace/configuration/xrd.yaml

# With options
./scripts/xrd-transform.sh -t debug path/to/xrd.yaml
./scripts/xrd-transform.sh -o output/ path/to/xrd.yaml
./scripts/xrd-transform.sh -v path/to/xrd.yaml

# Direct bin usage (if installed via npm)
npx ingestor path/to/xrd.yaml
```

**[→ Full XRD Transform Documentation](./docs/xrd-transform-examples.md)**

**Implementation:**
- Shell wrapper: `scripts/xrd-transform.sh` → `bin/ingestor`
- Workspace wrapper: `portal-workspace/scripts/template-ingest.sh` → plugin script
- TypeScript CLI: `src/xrd-transform/cli/xrd-transform-cli.ts`

### Backstage Export Script (Template Export)

Export entities from a running Backstage catalog:

```bash
# From plugin directory
./scripts/backstage-export.sh --kind Template

# From workspace root (delegates to plugin script)
./scripts/template-export.sh --kind Template

# Export with filters
./scripts/backstage-export.sh --kind Template --tags crossplane --organize

# Preview what would be exported
./scripts/backstage-export.sh --preview --kind Template,API

# List entities only
./scripts/backstage-export.sh --list --kind API

# Direct bin usage (if installed via npm)
npx backstage-export --kind Template
```

**[→ Full Export CLI Documentation](./docs/cli-export.md)**

**Implementation:**
- Shell wrapper: `scripts/backstage-export.sh` → `bin/backstage-export`
- Workspace wrapper: `portal-workspace/scripts/template-export.sh` → plugin script
- TypeScript CLI: `src/backstage-export/cli/backstage-export-cli.ts`
- Auto-detects API token from app-config files

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

### Testing

The plugin includes comprehensive test coverage with yarn scripts matching CI:

```bash
# Run unit tests only
yarn test

# Run XRD transform regression tests only
yarn test:regression

# Run both unit and regression tests
yarn test:all

# Run complete CI test suite (compile, build, test, regression)
yarn test:ci
```

**What each command does:**
- `yarn test` - Jest unit tests via @backstage/cli
- `yarn test:regression` - XRD transform regression tests (`./run-tests.sh`)
- `yarn test:all` - Runs both test + test:regression
- `yarn test:ci` - Full CI pipeline: tsc → build → test → test:regression

**Test Coverage:**
- ✅ Unit tests for all core modules
- ✅ Namespaced and cluster-scoped resources
- ✅ Parameter annotations and GitOps workflows
- ✅ Complex property types (arrays, objects, booleans)
- ✅ Template and API entity generation

**[→ Full Testing Documentation](./tests/xrd-transform/README.md)**

### Test Maintainability

**⚠️ IMPORTANT:** The xrd-transform test suite uses expected output files with protective headers to prevent accidental test corruption.

**Test expectations should ONLY be updated when:**
1. You've added **new features** that intentionally change output
2. You've **fixed bugs** where the old output was incorrect
3. You've **modified templates** with a clear purpose

**Never blindly regenerate expected files!** Each expected test file includes a warning header that:
- Documents when updates are appropriate
- Reminds you to review changes carefully
- Ensures both Template AND API entities are generated
- Is validated by the test runner to prevent accidental removal

**Update process:**
```bash
# 1. Run tests to see differences
./run-tests.sh

# 2. Review each diff carefully - understand WHY it changed
# 3. Update expected file (keeping the warning header!)
cp tests/xrd-transform/output/01-basic-namespaced.yaml \
   tests/xrd-transform/expected/01-basic-namespaced.yaml

# 4. Document the change in your commit message
```

See [tests/xrd-transform/expected/](./tests/xrd-transform/expected/) for examples of properly formatted expected files.

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

## Future Architecture

We've documented a potential refactoring of the `KubernetesEntityProvider` using the Strategy Pattern for better extensibility and testability. See [Issue #6](https://github.com/open-service-portal/ingestor/issues/6) for the full architectural proposal.

**Priority**: Low (nice-to-have, not urgent) - The current implementation is working and tested.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Key Areas for Contribution

- Additional Kubernetes resource types
- Enhanced filtering capabilities
- Performance optimizations
- Documentation improvements
- Custom Handlebars helpers for template generation

## Support

- [GitHub Issues](https://github.com/open-service-portal/ingestor/issues)
- [Documentation](https://github.com/open-service-portal/ingestor/wiki)
- [Open Service Portal Discussions](https://github.com/open-service-portal/discussions)

## Credits

This plugin is based on the excellent work by [TeraSky](https://github.com/TeraSky-OSS) on their [kubernetes-ingestor plugin](https://terasky-oss.github.io/backstage-plugins/plugins/kubernetes-ingestor/overview).

## License

Apache 2.0 - See [LICENSE](LICENSE) for details.