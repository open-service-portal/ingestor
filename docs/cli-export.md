# Backstage Export CLI Usage Guide

The `backstage-export` CLI tool extracts entities from a running Backstage catalog for backup, migration, auditing, or analysis purposes. It connects directly to the Backstage API and can filter entities based on various criteria.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Authentication](#authentication)
- [Basic Usage](#basic-usage)
- [Command Options](#command-options)
- [Filtering Entities](#filtering-entities)
- [Output Formats](#output-formats)
- [Use Cases](#use-cases)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Overview

The export CLI provides capabilities to:
- Extract entities from Backstage catalog
- Filter by kind, namespace, owner, tags, and more
- Export for backup or migration
- Audit catalog contents
- Analyze entity relationships
- Generate reports on catalog state

### Key Features

- **Direct API Access**: Connects to Backstage REST API
- **Flexible Filtering**: Multiple filter criteria
- **Multiple Formats**: YAML or JSON output
- **Batch Operations**: Export multiple entity types
- **Manifest Generation**: Track what was exported
- **Preview Mode**: See what would be exported

## Installation

### From Source (Development)

```bash
# Clone the repository
git clone https://github.com/open-service-portal/ingestor.git
cd ingestor

# Install dependencies
yarn install

# Run directly with ts-node
npx ts-node src/cli/backstage-export.ts --help
```

### Using Wrapper Script

From the portal-workspace:

```bash
# The wrapper script handles path resolution
../scripts/template-export.sh --kind Template
```

### Global Installation (Future)

```bash
# Not yet published to npm
npm install -g @open-service-portal/backstage-plugin-ingestor
backstage-export --help
```

## Authentication

### No Authentication (Default)

For local development with guest access:

```bash
backstage-export --url http://localhost:7007 --kind Component
```

### Bearer Token Authentication

For production Backstage instances:

```bash
# Using environment variable
export BACKSTAGE_TOKEN=your-token-here
backstage-export --kind Template

# Using command line option
backstage-export --token your-token-here --kind Template

# Using token from file
backstage-export --token "$(cat token.txt)" --kind Template
```

### Obtaining a Token

#### Static Token (Development)

In `app-config.local.yaml`:
```yaml
backend:
  auth:
    keys:
      - secret: your-secret-key
    externalAccess:
      - type: static
        options:
          token: your-static-token
```

#### Service Account Token

```bash
# From Kubernetes service account
kubectl -n backstage get secret backstage-token -o jsonpath='{.data.token}' | base64 -d
```

#### GitHub Token (if configured)

Use a GitHub personal access token if Backstage uses GitHub auth.

## Basic Usage

### Export All Templates

```bash
backstage-export --kind Template
```

### Export to Specific Directory

```bash
backstage-export --kind Component --output ./backup
```

### Export Multiple Kinds

```bash
backstage-export --kind Template,Component,API
```

### Preview Mode

```bash
backstage-export --kind Template --preview
```

### List Mode

```bash
backstage-export --kind API --list
```

## Command Options

### Connection Options

| Option | Description | Default |
|--------|-------------|---------|
| `-u, --url <url>` | Backstage API URL | `http://localhost:7007` |
| `-t, --token <token>` | Authentication token | `$BACKSTAGE_TOKEN` |
| `--timeout <ms>` | Request timeout | `30000` |
| `--retry <count>` | Retry failed requests | `3` |

### Filter Options

| Option | Description | Default |
|--------|-------------|---------|
| `-k, --kind <kinds>` | Entity kinds (comma-separated) | Required |
| `-n, --namespace <ns>` | Namespace filter | All namespaces |
| `--name <pattern>` | Name pattern (supports wildcards) | All names |
| `--owner <owner>` | Owner filter | All owners |
| `--tags <tags>` | Tags filter (comma-separated) | All tags |
| `--lifecycle <phase>` | Lifecycle phase | All phases |
| `--type <type>` | Entity type filter | All types |

### Output Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <dir>` | Output directory | `./exported` |
| `-f, --format <fmt>` | Output format (yaml/json) | `yaml` |
| `--single-file` | Export all to one file | `false` |
| `--organize` | Organize by entity type | `false` |
| `--no-metadata` | Exclude metadata fields | `false` |
| `--manifest` | Generate export manifest | `false` |

### Operation Modes

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --preview` | Preview without exporting | `false` |
| `-l, --list` | List entities only | `false` |
| `--count` | Show count only | `false` |
| `--stats` | Show statistics | `false` |

### Verbosity

| Option | Description | Default |
|--------|-------------|---------|
| `--quiet` | Suppress non-error output | `false` |
| `--verbose` | Show detailed information | `false` |
| `--debug` | Show debug information | `false` |
| `--no-color` | Disable colored output | `false` |

## Filtering Entities

### By Kind

```bash
# Single kind
backstage-export --kind Template

# Multiple kinds
backstage-export --kind Template,Component,API

# All kinds (special value)
backstage-export --kind ALL
```

### By Namespace

```bash
# Specific namespace
backstage-export --kind Component --namespace production

# Multiple namespaces (comma-separated)
backstage-export --kind Component --namespace "production,staging"
```

### By Name Pattern

```bash
# Exact name
backstage-export --kind Template --name my-template

# Wildcard pattern
backstage-export --kind Component --name "service-*"

# Multiple patterns
backstage-export --kind Component --name "*-api,*-service"
```

### By Owner

```bash
# Single owner
backstage-export --kind Component --owner platform-team

# Group owner
backstage-export --kind Component --owner "group:platform-team"

# User owner
backstage-export --kind Component --owner "user:john.doe"
```

### By Tags

```bash
# Single tag
backstage-export --kind Template --tags crossplane

# Multiple tags (AND logic)
backstage-export --kind Template --tags "crossplane,production"

# Tag with value
backstage-export --kind Component --tags "env:production"
```

### By Type

```bash
# Service components
backstage-export --kind Component --type service

# Library components
backstage-export --kind Component --type library

# XRD templates
backstage-export --kind Template --type crossplane-xrd
```

### Combined Filters

```bash
# Production services owned by platform team
backstage-export \
  --kind Component \
  --type service \
  --namespace production \
  --owner platform-team \
  --tags "tier:1"
```

## Output Formats

### Default Structure

```bash
backstage-export --kind Template
# Creates:
#   ./exported/templates.yaml (or templates.json)
```

### Organized Structure

```bash
backstage-export --kind Template,Component --organize
# Creates:
#   ./exported/Template/template1.yaml
#   ./exported/Template/template2.yaml
#   ./exported/Component/component1.yaml
#   ./exported/Component/component2.yaml
```

### Single File

```bash
backstage-export --kind Template,Component --single-file
# Creates:
#   ./exported/entities.yaml (contains all entities)
```

### With Manifest

```bash
backstage-export --kind Template --manifest
# Creates:
#   ./exported/templates.yaml
#   ./exported/manifest.json
```

Manifest example:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "source": "http://localhost:7007",
  "filters": {
    "kind": ["Template"]
  },
  "statistics": {
    "total": 15,
    "byKind": {
      "Template": 15
    }
  },
  "entities": [
    {
      "kind": "Template",
      "namespace": "default",
      "name": "xdnsrecord"
    }
  ]
}
```

## Use Cases

### 1. Backup and Recovery

```bash
#!/bin/bash
# backup-catalog.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/catalog_$DATE"

# Export all critical entities
backstage-export \
  --url https://backstage.example.com \
  --token "$BACKSTAGE_TOKEN" \
  --kind Template,Component,System,Domain,API \
  --output "$BACKUP_DIR" \
  --organize \
  --manifest

# Compress backup
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

echo "Backup created: $BACKUP_DIR.tar.gz"
```

### 2. Migration Between Instances

```bash
# Export from source
backstage-export \
  --url https://old-backstage.example.com \
  --token "$OLD_TOKEN" \
  --kind ALL \
  --output ./migration \
  --organize

# Import to target (using separate import tool or API)
for file in ./migration/**/*.yaml; do
  curl -X POST https://new-backstage.example.com/api/catalog/entities \
    -H "Authorization: Bearer $NEW_TOKEN" \
    -H "Content-Type: application/yaml" \
    --data-binary "@$file"
done
```

### 3. Audit and Compliance

```bash
# Generate audit report
backstage-export \
  --kind Component \
  --list \
  --stats > audit-report.txt

# Export components missing owners
backstage-export \
  --kind Component \
  --output ./audit/no-owner \
  --filter '!metadata.owner'

# Export production components
backstage-export \
  --kind Component \
  --lifecycle production \
  --output ./audit/production \
  --manifest
```

### 4. Template Analysis

```bash
# Export all Crossplane templates
backstage-export \
  --kind Template \
  --type crossplane-xrd \
  --output ./crossplane-templates

# Analyze template usage
backstage-export \
  --kind Template \
  --stats \
  --verbose | grep "Usage count"
```

### 5. CI/CD Integration

```yaml
# .github/workflows/backup-catalog.yml
name: Backup Catalog
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Export Tool
        run: npm install -g @open-service-portal/backstage-plugin-ingestor

      - name: Export Catalog
        env:
          BACKSTAGE_TOKEN: ${{ secrets.BACKSTAGE_TOKEN }}
        run: |
          backstage-export \
            --url https://backstage.example.com \
            --kind ALL \
            --output ./catalog-backup \
            --manifest

      - name: Upload Backup
        uses: actions/upload-artifact@v3
        with:
          name: catalog-backup-${{ github.run_id }}
          path: ./catalog-backup
          retention-days: 30
```

## Examples

### Basic Examples

```bash
# Export all templates
backstage-export --kind Template

# Export with preview
backstage-export --kind Component --preview

# List all APIs
backstage-export --kind API --list

# Export to JSON
backstage-export --kind System --format json

# Custom output directory
backstage-export --kind Domain --output ./domains
```

### Advanced Examples

```bash
# Export production services
backstage-export \
  --kind Component \
  --type service \
  --lifecycle production \
  --output ./prod-services \
  --organize

# Export with full filtering
backstage-export \
  --url https://backstage.example.com \
  --token "$TOKEN" \
  --kind Template,Component \
  --namespace default \
  --owner platform-team \
  --tags "managed,v2" \
  --output ./filtered-export \
  --manifest

# Generate statistics report
backstage-export \
  --kind ALL \
  --stats \
  --count \
  --verbose > catalog-stats.txt

# Export for documentation
backstage-export \
  --kind API \
  --format json \
  --no-metadata \
  --output ./api-docs

# Incremental export (new entities only)
backstage-export \
  --kind Component \
  --filter 'metadata.createdAt>2024-01-01' \
  --output ./new-components
```

### Real-World Scenarios

#### Scenario 1: Disaster Recovery Setup

```bash
#!/bin/bash
# disaster-recovery.sh

# Full catalog export
echo "Starting full catalog backup..."

backstage-export \
  --url "$BACKSTAGE_URL" \
  --token "$BACKSTAGE_TOKEN" \
  --kind ALL \
  --output ./dr-backup \
  --organize \
  --manifest

# Verify export
if [ -f ./dr-backup/manifest.json ]; then
  TOTAL=$(jq '.statistics.total' ./dr-backup/manifest.json)
  echo "Successfully exported $TOTAL entities"
else
  echo "Export failed!"
  exit 1
fi

# Create recovery script
cat > ./dr-backup/restore.sh << 'EOF'
#!/bin/bash
# Restore script for catalog entities

BACKSTAGE_URL=${1:-http://localhost:7007}
TOKEN=${2:-}

for file in */**.yaml; do
  echo "Importing $file..."
  curl -X POST "$BACKSTAGE_URL/api/catalog/entities" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/yaml" \
    --data-binary "@$file"
done
EOF

chmod +x ./dr-backup/restore.sh
tar -czf dr-backup-$(date +%Y%m%d).tar.gz ./dr-backup
```

#### Scenario 2: Catalog Synchronization

```bash
#!/bin/bash
# sync-catalogs.sh

SOURCE_URL="https://backstage-prod.example.com"
TARGET_URL="https://backstage-staging.example.com"

# Export from production
echo "Exporting from production..."
backstage-export \
  --url "$SOURCE_URL" \
  --token "$PROD_TOKEN" \
  --kind Template,System,Domain \
  --output ./sync-temp \
  --organize

# Transform if needed (example: change owner)
find ./sync-temp -name "*.yaml" -exec sed -i 's/owner: prod-team/owner: staging-team/g' {} \;

# Import to staging
echo "Importing to staging..."
for file in ./sync-temp/**/*.yaml; do
  curl -X POST "$TARGET_URL/api/catalog/entities" \
    -H "Authorization: Bearer $STAGING_TOKEN" \
    -H "Content-Type: application/yaml" \
    --data-binary "@$file" \
    --silent --output /dev/null
done

echo "Synchronization complete"
rm -rf ./sync-temp
```

#### Scenario 3: Ownership Audit

```bash
#!/bin/bash
# ownership-audit.sh

echo "Catalog Ownership Audit Report"
echo "=============================="
echo ""

# Export all components
backstage-export \
  --kind Component \
  --output ./audit-temp \
  --quiet

# Analyze ownership
echo "Components by Owner:"
echo "-------------------"
grep -h "owner:" ./audit-temp/*.yaml | sort | uniq -c | sort -rn

echo ""
echo "Components without owners:"
echo "-------------------------"
grep -L "owner:" ./audit-temp/*.yaml | wc -l

echo ""
echo "Orphaned components (no owner field):"
echo "------------------------------------"
for file in ./audit-temp/*.yaml; do
  if ! grep -q "owner:" "$file"; then
    basename "$file" .yaml
  fi
done

# Cleanup
rm -rf ./audit-temp
```

## Troubleshooting

### Connection Issues

```bash
# Test connection
curl -I http://localhost:7007/api/catalog/entities

# Check with token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:7007/api/catalog/entities?limit=1

# Verbose mode for debugging
backstage-export --kind Template --debug
```

### Authentication Errors

```bash
# Verify token is set
echo $BACKSTAGE_TOKEN

# Test token directly
curl -H "Authorization: Bearer $BACKSTAGE_TOKEN" \
  http://localhost:7007/api/catalog/entities

# Try without token (guest access)
backstage-export --kind Template --token ""
```

### No Entities Found

```bash
# Check available kinds
backstage-export --kind ALL --list

# Try without filters
backstage-export --kind Component

# Use debug mode
backstage-export --kind Template --debug

# Check API directly
curl http://localhost:7007/api/catalog/entities?filter=kind=Template
```

### Performance Issues

```bash
# Export in batches by namespace
for ns in default production staging; do
  backstage-export --kind Component --namespace "$ns" --output "./export-$ns"
done

# Limit fields exported
backstage-export --kind Component --no-metadata

# Increase timeout for large catalogs
backstage-export --kind ALL --timeout 60000
```

### Export Validation

```bash
# Validate exported YAML
for file in exported/*.yaml; do
  yq eval '.' "$file" > /dev/null || echo "Invalid: $file"
done

# Check entity structure
yq eval '.kind, .metadata.name' exported/templates.yaml

# Verify manifest
jq '.statistics' exported/manifest.json
```

## Environment Variables

```bash
# Backstage URL
export BACKSTAGE_URL=https://backstage.example.com
backstage-export --kind Template

# Authentication token
export BACKSTAGE_TOKEN=your-token-here
backstage-export --kind Component

# Default output directory
export BACKSTAGE_EXPORT_DIR=./my-exports
backstage-export --kind API

# Debug mode
export BACKSTAGE_DEBUG=true
backstage-export --kind System
```

## Best Practices

1. **Use Preview First**: Always preview before large exports
2. **Filter Appropriately**: Don't export ALL unless necessary
3. **Organize Large Exports**: Use `--organize` for many entities
4. **Include Manifests**: Use `--manifest` for audit trail
5. **Secure Tokens**: Never commit tokens to version control
6. **Validate Exports**: Check exported files are valid YAML/JSON
7. **Incremental Backups**: Export only changed entities when possible
8. **Document Filters**: Record what filters were used for exports

## API Compatibility

The export tool is compatible with:
- Backstage v1.0+
- Catalog API v1
- Both alpha and stable API endpoints

For older Backstage versions, use appropriate API paths:
```bash
# Legacy API path
backstage-export --url http://localhost:7007/catalog
```

## See Also

- [Ingestor CLI Guide](./cli-ingestor.md)
- [Configuration Reference](./configuration.md)
- [Architecture Overview](./architecture.md)
- [Backstage Catalog API](https://backstage.io/docs/features/software-catalog/software-catalog-api)