# Ingestor CLI Specification

## Overview

The Ingestor CLI processes Kubernetes resources (particularly Crossplane XRDs) and generates Backstage catalog entities. It provides a command-line interface for testing, validating, and processing resources outside of the Backstage runtime environment.

## Design Principles

1. **Unified Core**: Same ingestion logic as the Backstage runtime plugin
2. **Simple Interface**: Single source argument with flag-based modes
3. **Unix Philosophy**: Do one thing well - ingest resources into entities
4. **Predictable Behavior**: Consistent output and error handling

## Command Structure

```bash
ingestor <source> [options]
```

### Arguments

- `source`: Required. Can be:
  - File path: `xrd.yaml`, `./configs/my-xrd.yaml`
  - Directory path: `./xrds/`, `/path/to/templates/`
  - Cluster keyword: `cluster` (uses current kubectl context)

### Mode Flags (Mutually Exclusive)

- `-p, --preview`: Preview what would be generated without writing files
- `-v, --validate`: Validate resources only, exit with status code
- `-l, --list`: List discovered resources without processing

### Options

**Input Options:**
- `-c, --config <file>`: Configuration file path
- `-t, --type <type>`: Resource type filter (xrd, k8s, all)
- `-n, --namespace <ns>`: Namespace filter for cluster source

**Output Options:**
- `-o, --output <dir>`: Output directory (default: ./output)
- `-f, --format <fmt>`: Output format - yaml or json (default: yaml)
- `--organize`: Organize output by entity type

**Entity Metadata:**
- `--owner <owner>`: Set owner for generated entities
- `--tags <tags>`: Add tags to entities (comma-separated)

**Display Options:**
- `--quiet`: Suppress non-error output
- `--verbose`: Show detailed processing information
- `-h, --help`: Show help message
- `--version`: Show version information

## Functional Requirements

### Resource Discovery

The CLI must discover resources from three source types:

1. **File Source**
   - Single YAML/JSON file
   - Multi-document YAML support
   - Error on non-existent files

2. **Directory Source**
   - Recursive directory scanning
   - Filter by file extensions (.yaml, .yml, .json)
   - Skip hidden files and directories
   - Handle symlinks safely

3. **Cluster Source**
   - Use current kubectl context
   - Support namespace filtering
   - Handle RBAC permissions gracefully
   - Timeout after 30 seconds

### Processing Pipeline

```
Discovery → Validation → Conversion → Output
```

1. **Discovery Phase**
   - Load resources from source
   - Parse YAML/JSON
   - Extract resource metadata

2. **Validation Phase**
   - Check resource structure
   - Validate required fields
   - Verify API versions
   - Report validation errors

3. **Conversion Phase**
   - Use shared IngestionEngine
   - Build Backstage entities
   - Apply metadata overrides

4. **Output Phase**
   - Format entities (YAML/JSON)
   - Write to filesystem
   - Organize by type if requested

### Mode Behaviors

#### Default Mode (Process)
- Discovers resources
- Validates resources
- Converts to entities
- Writes to output directory
- Shows summary

#### Preview Mode (`--preview`)
- Discovers resources
- Validates resources
- Shows what would be generated
- No file writes
- Displays entity counts and types

#### Validate Mode (`--validate`)
- Discovers resources
- Validates resources
- Reports validation results
- Exit code 0 for success, 2 for validation failure
- No conversion or output

#### List Mode (`--list`)
- Discovers resources
- Lists resource names and types
- Shows basic metadata
- No validation or conversion

## Technical Architecture

### Shared Core Engine

```typescript
interface IngestionEngine {
  ingest(resources: Resource[]): Promise<Entity[]>
}
```

The CLI uses the same `IngestionEngine` as the Backstage runtime plugin, ensuring consistent behavior.

### CLI Adapter

```typescript
class CLIAdapter {
  constructor(private engine: IngestionEngine) {}

  async processFile(path: string, options: Options): Promise<void> {
    const resources = await this.loadFile(path);
    const entities = await this.engine.ingest(resources);
    await this.writeEntities(entities, options);
  }
}
```

### Configuration Loading

Priority order:
1. Command-line flags (highest)
2. Config file (`--config`)
3. Environment variables
4. Backstage app-config.yaml (if found)
5. Default values (lowest)

## Output Specifications

### Directory Structure

Default output structure:
```
output/
├── templates/
│   ├── xrd1-template.yaml
│   └── xrd2-template.yaml
├── apis/
│   ├── xrd1-api.yaml
│   └── xrd2-api.yaml
└── components/
    └── service1-component.yaml
```

With `--organize` flag, entities are grouped by type.

### Entity Format

Generated entities follow Backstage catalog format:
```yaml
apiVersion: backstage.io/v1beta3
kind: Template
metadata:
  name: generated-name
  title: Human Readable Title
  description: Description from source
  tags:
    - ingestor
    - <additional-tags>
spec:
  owner: platform-team
  type: service
  # ... rest of spec
```

## Error Handling

### Exit Codes
- 0: Success
- 1: General error
- 2: Validation failed
- 3: No resources found
- 4: Configuration error
- 5: Cluster connection error

### Error Messages
Format: `[ERROR] <context>: <message>`

Example: `[ERROR] Validation: XRD 'my-xrd' missing required field 'spec.group'`

## Performance Requirements

- Single file: < 1 second
- Directory (100 files): < 10 seconds
- Cluster discovery: < 30 seconds timeout
- Memory usage: < 256MB typical, < 512MB maximum

## Examples

```bash
# Process single XRD
ingestor xrd.yaml

# Process with custom output
ingestor xrd.yaml --output ./backstage/templates --owner platform-team

# Preview directory processing
ingestor ./xrds/ --preview

# Validate before processing
ingestor ./xrds/ --validate && ingestor ./xrds/

# Process from cluster
ingestor cluster --namespace production

# List XRDs in cluster
ingestor cluster --list --type xrd

# Process with configuration
ingestor xrd.yaml --config ./ingestor.yaml

# Quiet mode for scripts
ingestor ./xrds/ --quiet --output ./generated
```

## Configuration Schema

```yaml
ingestor:
  defaults:
    owner: platform-team
    namespace: default
    tags:
      - ingestor
      - auto-generated

  discovery:
    includeNamespaces:
      - default
      - production
    excludeNamespaces:
      - kube-system
      - kube-public
    fileExtensions:
      - .yaml
      - .yml
      - .json

  processing:
    xrd:
      templateType: crossplane-resource
      includeVersions: all  # all, served, latest
      publishPhase:
        enabled: false
        repository: github.com?owner=org&repo=catalog
        branch: main

  output:
    format: yaml
    organize: true
    cleanOutput: false  # Remove output dir before writing

  validation:
    strict: false
    requiredFields:
      - apiVersion
      - kind
      - metadata.name
```

## Security Considerations

1. **File System Access**
   - Validate file paths to prevent directory traversal
   - Respect file permissions
   - Handle symlinks safely

2. **Cluster Access**
   - Use existing kubectl configuration
   - Respect RBAC permissions
   - Never store credentials

3. **Output Sanitization**
   - Sanitize generated file names
   - Validate output paths
   - Prevent overwriting system files

## Testing Requirements

### Unit Tests
- Resource discovery for each source type
- Validation logic
- Entity conversion
- Configuration loading

### Integration Tests
- End-to-end processing
- Mode flag behaviors
- Error handling
- Output generation

### E2E Tests
- Real XRD processing
- Cluster interaction
- Large directory processing
- Configuration precedence

## Future Enhancements

- Watch mode for continuous processing
- Incremental processing (only changed files)
- Parallel processing for large directories
- Plugin system for custom transformers
- Interactive mode with prompts
- Dry-run with diff output