# Backstage Export CLI Specification

## Overview

The Backstage Export CLI extracts entities from a running Backstage catalog. It provides backup, migration, and auditing capabilities by exporting catalog content to files.

## Design Principles

1. **Standalone Tool**: Separate from ingestor as it performs reverse operation
2. **API-First**: Works with Backstage REST API
3. **Flexible Filtering**: Rich query capabilities
4. **Batch Operations**: Efficient bulk exports

## Command Structure

```bash
backstage-export [options]
```

No positional arguments - all configuration via options.

### Authentication Options

- `-u, --url <url>`: Backstage URL (default: http://localhost:7007)
- `-t, --token <token>`: API token (or use BACKSTAGE_TOKEN env)

### Filter Options

- `-k, --kind <kinds>`: Entity kinds (comma-separated)
- `-n, --namespace <ns>`: Namespace filter
- `--name <pattern>`: Name pattern (supports wildcards)
- `--owner <owner>`: Owner filter
- `--tags <tags>`: Tags filter (comma-separated)

### Output Options

- `-o, --output <dir>`: Output directory (default: ./exported)
- `-f, --format <fmt>`: Output format - yaml or json (default: yaml)
- `--organize`: Organize output by entity type
- `--manifest`: Generate export manifest file

### Mode Flags (Mutually Exclusive)

- `-p, --preview`: Preview what would be exported
- `-l, --list`: List matching entities only

### Display Options

- `--quiet`: Suppress non-error output
- `--verbose`: Show detailed information
- `-h, --help`: Show help message
- `--version`: Show version information

## Functional Requirements

### API Communication

1. **Authentication**
   - Bearer token authentication
   - Auto-detect token from config files
   - Environment variable fallback

2. **API Endpoints**
   - `/api/catalog/entities` - List entities
   - Query parameter construction
   - Pagination handling
   - Error response handling

3. **Connection Management**
   - HTTPS support
   - Timeout handling (30 seconds)
   - Retry logic with exponential backoff
   - Connection pooling

### Filtering System

Build complex filters using Backstage catalog query syntax:

```typescript
interface FilterOptions {
  kind?: string[];
  namespace?: string;
  name?: string;      // Pattern matching
  owner?: string;
  tags?: string[];
  [key: string]: any;  // Custom filters
}
```

Query construction:
- `filter=kind=Template`
- `filter=metadata.namespace=default`
- `filter=metadata.name~xrd`
- Multiple filters are AND-ed

### Export Pipeline

```
Connect → Query → Fetch → Transform → Write
```

1. **Connect Phase**
   - Validate Backstage URL
   - Authenticate with token
   - Check API availability

2. **Query Phase**
   - Build filter query
   - Execute catalog query
   - Handle pagination

3. **Fetch Phase**
   - Retrieve entity data
   - Preserve relationships
   - Batch fetching

4. **Transform Phase**
   - Convert to output format
   - Clean sensitive data
   - Organize if requested

5. **Write Phase**
   - Create directory structure
   - Write entity files
   - Generate manifest

### Mode Behaviors

#### Default Mode (Export)
- Connects to Backstage
- Queries with filters
- Fetches matching entities
- Writes to output directory
- Shows summary

#### Preview Mode (`--preview`)
- Connects to Backstage
- Queries with filters
- Shows what would be exported
- Displays entity counts
- No file writes

#### List Mode (`--list`)
- Connects to Backstage
- Queries with filters
- Lists entity names and types
- Tabular output
- No file writes

## Technical Architecture

### Export Client

```typescript
class BackstageClient {
  constructor(
    private url: string,
    private token: string
  ) {}

  async queryEntities(filter: FilterOptions): Promise<Entity[]> {
    // API communication logic
  }
}

class ExportCLI {
  constructor(private client: BackstageClient) {}

  async export(options: ExportOptions): Promise<void> {
    const entities = await this.client.queryEntities(options.filters);
    await this.writeEntities(entities, options);
  }
}
```

### Authentication

Token discovery order:
1. Command-line flag (`--token`)
2. Environment variable (`BACKSTAGE_TOKEN`)
3. Config file search in app-portal directory
4. Error if no token found

## Output Specifications

### Directory Structure

Default structure:
```
exported/
├── templates/
│   └── *.yaml
├── apis/
│   └── *.yaml
├── components/
│   └── *.yaml
├── systems/
│   └── *.yaml
├── manifest.yaml
└── export-metadata.json
```

### Manifest Format

```yaml
apiVersion: backstage.io/v1alpha1
kind: ExportManifest
metadata:
  exportedAt: 2024-01-01T00:00:00Z
  backstageUrl: http://localhost:7007
  toolVersion: 1.0.0
spec:
  query:
    filters:
      kind: [Template, API]
      namespace: default
  results:
    total: 35
    byKind:
      Template: 25
      API: 10
  files:
    - path: templates/xrd1-template.yaml
      kind: Template
      name: xrd1-template
```

### Export Metadata

```json
{
  "export": {
    "timestamp": "2024-01-01T00:00:00Z",
    "tool": "backstage-export",
    "version": "1.0.0",
    "backstageUrl": "http://localhost:7007"
  },
  "query": {
    "filters": {
      "kind": ["Template", "API"],
      "namespace": "default"
    }
  },
  "results": {
    "total": 35,
    "byKind": {
      "Template": 25,
      "API": 10
    }
  }
}
```

## Error Handling

### Exit Codes
- 0: Success
- 1: General error
- 2: Authentication failed
- 3: Connection error
- 4: No entities found
- 5: Write error

### Error Messages
Format: `[ERROR] <context>: <message>`

Examples:
- `[ERROR] Auth: Invalid or expired token`
- `[ERROR] Connection: Cannot reach Backstage at http://localhost:7007`
- `[ERROR] Query: No entities match the specified filters`

## Performance Requirements

- Query response: < 5 seconds
- Export 100 entities: < 10 seconds
- Export 1000 entities: < 60 seconds
- Memory usage: < 256MB typical

## Security Considerations

- Never log tokens
- Sanitize URLs in output
- Support HTTPS with certificate validation
- Option to redact sensitive fields
- Secure token storage recommendations

## Examples

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
backstage-export --kind Template --manifest --output ./backup

# Export specific namespace
backstage-export --namespace production --output ./prod-backup

# Quiet mode for automation
backstage-export --kind Template --quiet --output ./nightly-backup
```

## Configuration File Support

```yaml
# .backstage-export.yaml
export:
  url: http://localhost:7007
  token: ${BACKSTAGE_TOKEN}

defaults:
  output: ./exported
  format: yaml
  organize: true

filters:
  kind:
    - Template
    - API
  excludeNamespaces:
    - backstage-system
```

Load with: `backstage-export --config .backstage-export.yaml`

## Integration Examples

### Backup Script
```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
backstage-export \
  --output ./backups/$DATE \
  --manifest \
  --organize
```

### CI/CD Integration
```yaml
- name: Export Templates
  run: |
    backstage-export \
      --url ${{ vars.BACKSTAGE_URL }} \
      --token ${{ secrets.BACKSTAGE_TOKEN }} \
      --kind Template \
      --output ./templates
```

### Docker Usage
```dockerfile
FROM node:20-alpine
RUN npm install -g @open-service-portal/backstage-plugin-ingestor
CMD ["backstage-export", "--config", "/config/export.yaml"]
```

## API Response Handling

### Success Response
```json
{
  "items": [
    {
      "apiVersion": "backstage.io/v1beta3",
      "kind": "Template",
      "metadata": { ... },
      "spec": { ... }
    }
  ],
  "totalItems": 100,
  "pageInfo": {
    "nextLink": "/api/catalog/entities?offset=50"
  }
}
```

### Error Response
```json
{
  "error": {
    "name": "AuthenticationError",
    "message": "Invalid token",
    "statusCode": 401
  }
}
```

## Pagination Strategy

1. Initial request with limit (default 100)
2. Follow `pageInfo.nextLink` if present
3. Accumulate results
4. Stop when no nextLink or max entities reached

## Rate Limiting

- Respect `X-RateLimit-*` headers
- Default delay between requests: 100ms
- Exponential backoff on 429 responses
- Max retries: 3

## Testing Requirements

### Unit Tests
- Filter query building
- API response parsing
- File writing logic
- Manifest generation

### Integration Tests
- API communication with mock server
- Authentication flow
- Pagination handling
- Error scenarios

### E2E Tests
- Export from real Backstage instance
- Large dataset handling
- Network interruption recovery
- Various filter combinations

## Future Enhancements

- GraphQL API support
- Incremental export (changes since last export)
- Direct cloud storage support (S3, GCS)
- Compression options
- Encryption for sensitive exports
- Import/restore functionality
- Webhook notifications on completion
- Scheduled exports via cron syntax