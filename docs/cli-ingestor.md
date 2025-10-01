# Ingestor CLI Usage Guide

The `ingestor-cli` is a command-line tool that uses the same ingestion engine as the Backstage runtime plugin to process Kubernetes resources and generate Backstage catalog entities. This ensures consistent behavior between development, testing, and production environments.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Command Options](#command-options)
- [Input Sources](#input-sources)
- [Output Formats](#output-formats)
- [Use Cases](#use-cases)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Overview

The ingestor CLI provides a standalone way to:
- Process Kubernetes YAML files without running Backstage
- Generate Backstage catalog entities from XRDs
- Validate resource compatibility
- Test template generation before deployment
- Debug ingestion issues

### Unified Architecture

The CLI uses the **exact same ingestion engine** as the runtime plugin. This means:
- Identical entity generation logic
- Same validation rules
- Consistent annotation handling
- Matching template structure

## Installation

### From Source (Development)

```bash
# Clone the repository
git clone https://github.com/open-service-portal/ingestor.git
cd ingestor

# Install dependencies
yarn install

# Run directly with ts-node (no build required)
npx ts-node src/cli/ingestor-cli.ts --help
```

### Using Wrapper Script

From the portal-workspace:

```bash
# The wrapper script handles path resolution
../scripts/template-ingest.sh xrd.yaml
```

### Global Installation (Future)

```bash
# Not yet published to npm
npm install -g @open-service-portal/backstage-plugin-ingestor
ingestor --help
```

## Basic Usage

### Simple Ingestion

```bash
# Process a single XRD file
ingestor-cli xrd.yaml

# Process multiple files
ingestor-cli xrd1.yaml xrd2.yaml composition.yaml

# Process a directory
ingestor-cli ./crossplane-resources/

# Process from stdin
cat xrd.yaml | ingestor-cli -

# Dry run (preview only)
ingestor-cli xrd.yaml --preview
```

### Default Behavior

Without options, the CLI:
1. Reads input files/directories
2. Processes Kubernetes resources
3. Generates Backstage entities
4. Writes YAML files to `./catalog-entities/`
5. Creates one file per entity kind

## Command Options

### Input Control

| Option | Description | Default |
|--------|-------------|---------|
| `[files...]` | Input files or directories | Required |
| `-` | Read from stdin | - |
| `--recursive` | Process directories recursively | `false` |
| `--follow-symlinks` | Follow symbolic links | `false` |

### Output Control

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <dir>` | Output directory | `./catalog-entities` |
| `-f, --format <format>` | Output format (yaml/json) | `yaml` |
| `--single-file` | Write all entities to one file | `false` |
| `--stdout` | Write to stdout instead of files | `false` |
| `--organize` | Organize by entity type in subdirs | `false` |

### Entity Customization

| Option | Description | Default |
|--------|-------------|---------|
| `--owner <owner>` | Set entity owner | `platform-team` |
| `--namespace <ns>` | Set entity namespace | `default` |
| `--tags <tags>` | Add tags (comma-separated) | - |
| `--system <system>` | Set system reference | `platform` |
| `--domain <domain>` | Set domain reference | - |

### Processing Modes

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --preview` | Preview without writing files | `false` |
| `-v, --validate` | Validate only, no output | `false` |
| `--strict` | Fail on validation warnings | `false` |
| `--skip-validation` | Skip entity validation | `false` |

### Filtering

| Option | Description | Default |
|--------|-------------|---------|
| `--kind <kinds>` | Filter by resource kind | All kinds |
| `--api-version <ver>` | Filter by API version | All versions |
| `--name-pattern <regex>` | Filter by name pattern | - |
| `--label-selector <sel>` | Kubernetes label selector | - |

### Verbosity

| Option | Description | Default |
|--------|-------------|---------|
| `--quiet` | Suppress non-error output | `false` |
| `--verbose` | Show detailed information | `false` |
| `--debug` | Show debug information | `false` |
| `--no-color` | Disable colored output | `false` |

## Input Sources

### File Input

```bash
# Single file
ingestor-cli my-xrd.yaml

# Multiple files
ingestor-cli xrd1.yaml xrd2.yaml

# Glob patterns (shell expansion)
ingestor-cli *.yaml

# Mixed YAML documents
ingestor-cli resources.yaml  # Contains multiple documents
```

### Directory Input

```bash
# Process all YAML files in directory
ingestor-cli ./k8s-resources/

# Recursive processing
ingestor-cli ./k8s-resources/ --recursive

# With file filtering
ingestor-cli ./k8s-resources/ --kind CompositeResourceDefinition
```

### Stdin Input

```bash
# From cat
cat xrd.yaml | ingestor-cli -

# From kubectl
kubectl get xrd -o yaml | ingestor-cli -

# From curl
curl https://example.com/xrd.yaml | ingestor-cli -

# Combined with other files
cat xrd.yaml | ingestor-cli - composition.yaml
```

## Output Formats

### YAML Output (Default)

```bash
ingestor-cli xrd.yaml
# Creates: ./catalog-entities/template.yaml
```

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: xdnsrecord
  namespace: default
spec:
  type: crossplane-xrd
  # ... rest of template
```

### JSON Output

```bash
ingestor-cli xrd.yaml --format json
# Creates: ./catalog-entities/template.json
```

```json
{
  "apiVersion": "scaffolder.backstage.io/v1beta3",
  "kind": "Template",
  "metadata": {
    "name": "xdnsrecord",
    "namespace": "default"
  },
  "spec": {
    "type": "crossplane-xrd"
  }
}
```

### Single File Output

```bash
ingestor-cli *.yaml --single-file --output catalog.yaml
# Creates: catalog.yaml with all entities
```

### Organized Output

```bash
ingestor-cli *.yaml --organize
# Creates:
#   ./catalog-entities/Template/xdnsrecord.yaml
#   ./catalog-entities/API/dns-api.yaml
#   ./catalog-entities/System/platform.yaml
```

### Stdout Output

```bash
# Direct to stdout
ingestor-cli xrd.yaml --stdout

# Pipe to another command
ingestor-cli xrd.yaml --stdout | yq '.metadata.name'

# Redirect to file
ingestor-cli xrd.yaml --stdout > entities.yaml
```

## Use Cases

### 1. Testing XRD Templates

Before deploying an XRD to your cluster:

```bash
# Validate XRD structure
ingestor-cli new-xrd.yaml --validate

# Preview generated template
ingestor-cli new-xrd.yaml --preview

# Generate template with custom tags
ingestor-cli new-xrd.yaml --tags "database,postgresql,cloud"
```

### 2. Bulk Import from Cluster

Export resources from cluster and generate entities:

```bash
# Export XRDs from cluster
kubectl get xrd -o yaml > xrds.yaml

# Generate templates
ingestor-cli xrds.yaml --owner platform-team --system crossplane

# Review generated templates
ls -la catalog-entities/
```

### 3. CI/CD Pipeline Integration

```bash
#!/bin/bash
# ci-validate-xrds.sh

# Validate all XRDs in repository
for xrd in xrds/*.yaml; do
  echo "Validating $xrd..."
  ingestor-cli "$xrd" --validate --strict || exit 1
done

# Generate templates for review
ingestor-cli xrds/*.yaml --output .preview --preview
```

### 4. Development Workflow

```bash
# Watch for changes and regenerate
while inotifywait -e modify xrd.yaml; do
  clear
  ingestor-cli xrd.yaml --preview
done

# Quick validation during development
alias xrdcheck='ingestor-cli --validate'
xrdcheck my-xrd.yaml
```

### 5. Debugging Ingestion Issues

```bash
# Verbose output for debugging
ingestor-cli problematic-xrd.yaml --verbose --debug

# Validate with strict mode
ingestor-cli problematic-xrd.yaml --validate --strict

# Check specific resource
kubectl get xrd my-xrd -o yaml | ingestor-cli - --debug
```

## Examples

### Basic Examples

```bash
# Simple ingestion
ingestor-cli xrd.yaml

# Custom output directory
ingestor-cli xrd.yaml --output ./backstage-entities

# JSON format
ingestor-cli xrd.yaml --format json

# Preview mode
ingestor-cli xrd.yaml --preview
```

### Advanced Examples

```bash
# Process with full customization
ingestor-cli xrd.yaml \
  --output ./catalog \
  --owner platform-team \
  --namespace production \
  --tags "crossplane,infrastructure,v2" \
  --system platform-core \
  --organize

# Filter and process specific kinds
ingestor-cli ./k8s-resources/ \
  --kind CompositeResourceDefinition \
  --api-version apiextensions.crossplane.io/v1 \
  --output ./xrd-templates

# Validate strictly with verbose output
ingestor-cli *.yaml \
  --validate \
  --strict \
  --verbose

# Generate single catalog file
ingestor-cli ./resources/ \
  --recursive \
  --single-file \
  --output all-entities.yaml

# Process from kubectl with filtering
kubectl get xrd -l platform=backstage -o yaml | \
  ingestor-cli - \
  --tags "auto-discovered" \
  --owner sre-team
```

### Real-World Scenarios

#### Scenario 1: XRD Development

```bash
# During XRD development
cd ~/crossplane-templates/dns-record

# Validate XRD
ingestor-cli xrd.yaml --validate --strict

# Preview template generation
ingestor-cli xrd.yaml --preview | less

# Generate template for testing
ingestor-cli xrd.yaml --output ./test-catalog

# Test with Backstage locally
cp test-catalog/template.yaml ~/backstage/packages/backend/templates/
```

#### Scenario 2: Cluster Migration

```bash
# Export from old cluster
kubectl --context old-cluster get xrd -o yaml > old-xrds.yaml

# Generate templates with new configuration
ingestor-cli old-xrds.yaml \
  --owner new-platform-team \
  --namespace new-platform \
  --tags "migrated,legacy" \
  --output ./migration-catalog

# Review and import to new Backstage
cd migration-catalog
for file in *.yaml; do
  echo "Importing $file..."
  curl -X POST http://backstage.new-cluster/api/catalog/locations \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"file\",\"target\":\"file:./templates/$file\"}"
done
```

#### Scenario 3: GitOps Workflow

```bash
# In GitHub Actions workflow
- name: Generate Backstage Templates
  run: |
    # Install ingestor
    npm install -g @open-service-portal/backstage-plugin-ingestor

    # Generate templates from XRDs
    ingestor-cli xrds/*.yaml \
      --output ./generated-templates \
      --owner "${{ github.repository_owner }}" \
      --tags "gitops,auto-generated,pr-${{ github.event.number }}"

    # Commit generated templates
    git add generated-templates/
    git commit -m "Generated Backstage templates from XRDs"
    git push
```

## Troubleshooting

### Common Issues

#### No Output Generated

```bash
# Check if resources are recognized
ingestor-cli xrd.yaml --verbose

# Verify resource kind is supported
ingestor-cli xrd.yaml --debug | grep "Processing"

# Check for validation errors
ingestor-cli xrd.yaml --validate --verbose
```

#### Validation Failures

```bash
# Show detailed validation errors
ingestor-cli xrd.yaml --validate --verbose

# Skip validation if needed
ingestor-cli xrd.yaml --skip-validation

# Check which fields are causing issues
ingestor-cli xrd.yaml --debug 2>&1 | grep -i error
```

#### Unexpected Entity Structure

```bash
# Compare with preview
ingestor-cli xrd.yaml --preview

# Check transformation logic
ingestor-cli xrd.yaml --debug

# Verify input structure
cat xrd.yaml | yq '.spec.versions[0].schema'
```

### Debug Mode

Enable debug output for detailed processing information:

```bash
# Full debug output
ingestor-cli xrd.yaml --debug

# Debug with filtering
ingestor-cli xrd.yaml --debug 2>&1 | grep -i transform

# Save debug output
ingestor-cli xrd.yaml --debug > debug.log 2>&1
```

### Environment Variables

```bash
# Set default owner
export INGESTOR_DEFAULT_OWNER=my-team
ingestor-cli xrd.yaml

# Enable debug by default
export INGESTOR_DEBUG=true
ingestor-cli xrd.yaml

# Custom output directory
export INGESTOR_OUTPUT_DIR=./my-catalog
ingestor-cli xrd.yaml
```

## Best Practices

1. **Always Preview First**: Use `--preview` before generating files
2. **Validate in CI**: Add `--validate --strict` to CI pipelines
3. **Use Meaningful Tags**: Help with entity discovery in Backstage
4. **Set Correct Owner**: Ensures proper ownership in catalog
5. **Organize Large Sets**: Use `--organize` for many entities
6. **Version Control**: Commit generated templates for history
7. **Document Customizations**: Note any special flags used

## Integration with Backstage

### Local Development

```bash
# Generate templates
ingestor-cli xrds/*.yaml --output ~/backstage/packages/backend/templates

# Register in Backstage
cd ~/backstage
yarn start
# Navigate to: http://localhost:3000/catalog-import
```

### Production Deployment

```bash
# Generate templates
ingestor-cli xrds/*.yaml --output ./catalog

# Push to Git
git add catalog/
git commit -m "Updated templates from XRDs"
git push

# Backstage will auto-discover from Git
```

## See Also

- [Backstage Export CLI Guide](./cli-export.md)
- [Configuration Reference](./configuration.md)
- [Architecture Overview](./architecture.md)
- [XRD Ingestion Details](./xrd-ingestion.md)