# CLI Implementation Guide

This document describes the CLI implementation architecture and how to extend it.

## Architecture Overview

The CLI tools follow a clean architecture pattern with three distinct layers:

```
┌─────────────────────────────────────────────────────┐
│                   Entry Points                      │
│  (bin/ingestor, bin/backstage-export)              │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                    Adapters                         │
│  (CLIAdapter, RuntimeAdapter, ExportAdapter)        │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  Core Engine                        │
│  (IngestionEngine, Validators, Builders)            │
└─────────────────────────────────────────────────────┘
```

## Key Design Principles

### 1. Unified Core Logic
The `IngestionEngine` contains all business logic for resource transformation. This ensures that whether a resource is processed via CLI or Backstage runtime, the output is identical.

### 2. Adapter Pattern
Adapters handle environment-specific I/O:
- **CLIAdapter**: File system operations, console output
- **RuntimeAdapter**: Kubernetes API access, Backstage catalog integration
- **ExportAdapter**: Backstage REST API communication

### 3. Dependency Injection
The engine accepts validators and builders via constructor injection, making it easy to extend with new resource types.

## Adding New Resource Types

To support a new Kubernetes resource type:

### 1. Create a Builder

```typescript
// src/core/builders/MyResourceBuilder.ts
export class MyResourceBuilder implements IEntityBuilder {
  canBuild(resource: Resource): boolean {
    return resource.kind === 'MyResource';
  }

  async build(resource: Resource, config?: EntityBuilderConfig): Promise<Entity[]> {
    // Transform resource to Backstage entities
    return [{
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: resource.metadata.name,
        // ... more metadata
      },
      spec: {
        // ... component spec
      }
    }];
  }
}
```

### 2. Register the Builder

```typescript
// src/cli/ingestor-cli.ts
import { createMyResourceBuilder } from '../core/builders/MyResourceBuilder';

const builders = [
  createXRDEntityBuilder(),
  createMyResourceBuilder(), // Add your builder
];
```

### 3. Add Validation (Optional)

```typescript
// src/core/validators/ResourceValidator.ts
private validateMyResource(resource: Resource, errors: ValidationError[]): void {
  // Add resource-specific validation
  if (!resource.spec.requiredField) {
    errors.push({
      field: 'spec.requiredField',
      message: 'Required field is missing',
      severity: 'error'
    });
  }
}
```

## CLI Development Workflow

### Building

```bash
# Compile TypeScript
yarn build:cli

# Output goes to dist/ directory
```

### Testing Locally

```bash
# Use ts-node for development (no build needed)
yarn cli:ingestor test.yaml --preview

# Or run compiled version
node dist/cli/ingestor-cli.js test.yaml
```

### Debugging

```bash
# Enable Node.js debugging
NODE_OPTIONS="--inspect" yarn cli:ingestor test.yaml

# With VS Code debugger
# Add breakpoint in source and use "Debug: Attach to Node Process"
```

## Export CLI Implementation

The export CLI uses a different pattern since it doesn't share logic with runtime:

```
BackstageClient → ExportAdapter → File System
```

### BackstageClient
Handles REST API communication:
- Bearer token authentication
- Pagination support
- Query parameter construction
- Error handling with retries

### ExportAdapter
Orchestrates the export process:
- Filter building
- Entity organization
- Manifest generation
- Multiple output formats

## Testing Strategy

### Unit Tests
Test individual components in isolation:

```typescript
// src/core/engine/IngestionEngine.test.ts
describe('IngestionEngine', () => {
  it('should validate resources before ingestion', async () => {
    const validator = createMockValidator();
    const engine = new IngestionEngine(validator, []);

    const results = await engine.validate([mockResource]);
    expect(results.get(mockResource)).toHaveProperty('valid', true);
  });
});
```

### Integration Tests
Test complete flows:

```typescript
// src/cli/integration.test.ts
describe('CLI Integration', () => {
  it('should ingest XRD and produce template', async () => {
    const output = await runCLI(['test-xrd.yaml', '--format', 'json']);
    const entities = JSON.parse(output);

    expect(entities).toHaveLength(2); // Template + API
    expect(entities[0].kind).toBe('Template');
  });
});
```

### E2E Tests
Test with real Backstage instance:

```bash
# Start Backstage
yarn start

# Run export test
backstage-export --url http://localhost:7007 --list

# Verify output
```

## Error Handling

The CLI tools use consistent error handling:

1. **Validation Errors**: Show field-level issues
2. **Connection Errors**: Suggest troubleshooting steps
3. **File System Errors**: Check permissions and paths
4. **API Errors**: Include status codes and messages

### Error Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Authentication failed |
| 3 | Connection error |
| 4 | No entities found |
| 5 | Write error |

## Performance Considerations

### Memory Usage
- Stream large files instead of loading into memory
- Process resources in batches
- Clear caches between operations

### Optimization Tips
- Use `--quiet` flag to reduce console output overhead
- Process directories in parallel when possible
- Cache validated resources to avoid re-validation

## Future Enhancements

Potential areas for improvement:

1. **Plugin System**: Allow external builders/validators
2. **Streaming Output**: Support for stdout piping
3. **Progress Indicators**: Show progress for large operations
4. **Diff Mode**: Compare before/after states
5. **Watch Mode**: Auto-process on file changes
6. **Remote Sources**: Support URLs and S3 buckets