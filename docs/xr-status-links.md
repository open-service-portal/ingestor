# XR Status Links Feature

This document provides comprehensive documentation for the XR Status Links feature, which automatically extracts and generates navigation links from Kubernetes resource status fields.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Supported Status Fields](#supported-status-fields)
- [Implementation Details](#implementation-details)
- [Configuration](#configuration)
- [Examples](#examples)
- [Testing](#testing)
- [Extending the Feature](#extending-the-feature)

## Overview

The XR Status Links feature enhances Backstage catalog entities by automatically discovering and adding links from Kubernetes resource status fields. This is particularly valuable for Crossplane Composite Resources (XRs) where compositions often populate status fields with URLs, endpoints, and other connection information.

### Key Benefits

- **Automatic Discovery**: No manual configuration needed for standard fields
- **Rich Navigation**: Direct links to services, dashboards, and tools
- **Consistent UX**: Standardized link presentation across all resources
- **Extensible**: Support for custom status field formats
- **Type-Safe**: Full TypeScript implementation with interfaces

## Architecture

### Component Overview

```
KubernetesEntityProvider
├── translateKubernetesObjectsToEntities()
│   └── buildComponentEntity()
│       └── generateLinksFromXRStatus()
│           ├── Parse status object
│           ├── Extract known fields
│           ├── Transform to BackstageLink[]
│           └── Return links array
```

### Data Flow

1. **Resource Discovery**: Kubernetes resources are fetched from clusters
2. **Status Extraction**: The `status` object is extracted from each resource
3. **Field Detection**: Known fields are identified and processed
4. **Link Generation**: URLs are constructed with appropriate titles and icons
5. **Entity Enhancement**: Links are added to the Backstage entity metadata

## Supported Status Fields

### Simple URL Fields

These fields are expected to contain direct URL strings:

| Field | Description | Link Title | Example |
|-------|-------------|------------|---------|
| `status.domain` | Service domain | "Service Domain" | `example.com` → `https://example.com` |
| `status.url` | Direct URL | "Service URL" | `https://api.example.com` |
| `status.externalURL` | External dashboard | "External URL" | `https://dashboard.example.com` |
| `status.hostname` | Service hostname | "Service Hostname" | `service.local` → `https://service.local` |

### Domain Fields with DNS Query

Fields that trigger both a service link and DNS query link:

| Field | Description | Links Generated | Example |
|-------|-------------|-----------------|---------|
| `status.fqdn` | Fully qualified domain | Service link + DNS query | `app.example.com` → Service + DNS lookup |

### Complex Object Fields

These fields can be either strings or objects with additional metadata:

#### Endpoint Field

```yaml
# String format
status:
  endpoint: "https://api.example.com"

# Object format
status:
  endpoint:
    url: "https://api.example.com"
    title: "Main API"
    icon: "Cloud"  # Material-UI icon name
```

#### Endpoints Array

```yaml
status:
  endpoints:
    # String entries
    - "https://api.example.com"
    - "postgresql://db.example.com:5432"

    # Object entries
    - url: "https://admin.example.com"
      title: "Admin Console"
      icon: "Dashboard"

    # Mixed with name field
    - url: "https://metrics.example.com"
      name: "Metrics Dashboard"  # Falls back to 'name' if no 'title'
```

#### URLs Array

```yaml
status:
  urls:
    # String entries
    - "https://docs.example.com"

    # Object with href
    - href: "https://api.example.com"
      title: "API Documentation"
```

### Nested Fields

| Field | Description | Link Title | Example |
|-------|-------------|------------|---------|
| `status.ingress.host` | Ingress hostname | "Ingress URL" | `app.example.com` → `https://app.example.com` |

### Conditional Fields

#### Address Field

Only generates a link if it contains a dot (indicating a domain):

```yaml
# Generates link
status:
  address: "db.internal.example.com"  # Contains dots

# No link generated
status:
  address: "192-168-1-1"  # No dots, likely an IP
```

## Implementation Details

### Core Function

The main implementation is in `KubernetesEntityProvider.ts`:

```typescript
private generateLinksFromXRStatus(xr: any): BackstageLink[] {
  const links: BackstageLink[] = [];

  if (!xr.status) {
    return links;
  }

  // Extract domain
  if (xr.status.domain) {
    links.push({
      url: `https://${xr.status.domain}`,
      title: 'Service Domain',
      icon: 'WebAsset',
    });
  }

  // Extract FQDN with DNS query
  if (xr.status.fqdn) {
    links.push({
      url: `https://dns.google/query?name=${xr.status.fqdn}&type=ALL`,
      title: 'DNS Query (Google)',
      icon: 'DNS',
    });
  }

  // ... more field extractions

  return links;
}
```

### BackstageLink Interface

```typescript
interface BackstageLink {
  url: string;      // The target URL
  title: string;    // Display text for the link
  icon?: string;    // Optional Material-UI icon name
}
```

### Integration Point

Links are added during entity building:

```typescript
private buildComponentEntity(resource: any): Entity {
  // ... existing entity building logic

  // Generate links from XR status
  const statusLinks = this.generateLinksFromXRStatus(resource);

  // Add links to entity metadata
  if (statusLinks.length > 0) {
    entity.metadata.links = [
      ...(entity.metadata.links || []),
      ...statusLinks,
    ];
  }

  return entity;
}
```

## Configuration

### Enable/Disable

The feature is automatically enabled when the ingestor processes resources. No specific configuration is required.

### Custom Annotation Prefix

If using a custom annotation prefix, ensure consistency:

```yaml
kubernetesIngestor:
  annotationPrefix: 'mycompany.io'  # Affects annotation handling
```

### Icon Customization

Icons use Material-UI icon names. Common options:
- `'WebAsset'` - Generic web resource
- `'Cloud'` - Cloud service
- `'Dashboard'` - Dashboard/UI
- `'DNS'` - DNS-related
- `'Storage'` - Database/storage
- `'Api'` - API endpoint

## Examples

### Basic PostgreSQL Database

```yaml
apiVersion: platform.io/v1alpha1
kind: XPostgreSQLInstance
metadata:
  name: user-db
  namespace: production
status:
  # Simple fields
  domain: db.example.com
  fqdn: postgres.db.example.com

  # Connection endpoint
  endpoint:
    url: postgresql://db.example.com:5432/users
    title: Database Connection
    icon: Storage

  # Admin interface
  externalURL: https://pgadmin.example.com/servers/user-db
```

Generated links:
1. **Service Domain**: `https://db.example.com`
2. **DNS Query (Google)**: DNS lookup for postgres.db.example.com
3. **Database Connection**: `postgresql://db.example.com:5432/users`
4. **External URL**: PgAdmin interface

### Multi-Service Application

```yaml
apiVersion: apps.io/v1alpha1
kind: XApplication
metadata:
  name: web-app
  namespace: production
status:
  # Main application URL
  url: https://app.example.com

  # Multiple endpoints
  endpoints:
    - url: https://app.example.com
      title: Frontend
      icon: WebAsset

    - url: https://api.app.example.com
      title: API Gateway
      icon: Api

    - url: https://admin.app.example.com
      title: Admin Panel
      icon: Dashboard

  # Monitoring
  externalURL: https://grafana.example.com/d/app-dashboard
```

### Kubernetes Service with Ingress

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-service
  namespace: default
status:
  # Ingress configuration
  ingress:
    host: web.example.com

  # Internal hostname
  hostname: web-service.default.svc.cluster.local

  # Load balancer address
  address: web.elb.amazonaws.com
```

## Testing

### Unit Tests

The feature includes comprehensive unit tests in `KubernetesEntityProvider.test.ts`:

```typescript
describe('generateLinksFromXRStatus', () => {
  it('should extract domain from status', () => {
    const xr = {
      status: {
        domain: 'example.com'
      }
    };

    const links = generateLinksFromXRStatus(xr);

    expect(links).toContainEqual({
      url: 'https://example.com',
      title: 'Service Domain',
      icon: 'WebAsset'
    });
  });

  // ... more test cases
});
```

### Manual Testing

1. Create a test XR with status fields:
```yaml
apiVersion: test.io/v1
kind: TestResource
metadata:
  name: test-links
status:
  domain: test.example.com
  endpoint: https://api.test.example.com
```

2. Apply to cluster:
```bash
kubectl apply -f test-xr.yaml
```

3. Wait for ingestion (check frequency in config)

4. Verify in Backstage:
```bash
# Check entity via API
curl http://localhost:7007/api/catalog/entities?filter=kind=Component,metadata.name=test-links

# Or view in UI
open http://localhost:3000/catalog/default/component/test-links
```

### Integration Testing

```bash
# Use the ingestor CLI to test locally
npx ts-node src/cli/ingestor-cli.ts test-xr.yaml --preview

# Check the generated links in output
grep -A 5 "links:" output.yaml
```

## Extending the Feature

### Adding New Status Fields

To support additional status fields, modify `generateLinksFromXRStatus()`:

```typescript
// Add support for a new field
if (xr.status.myCustomField) {
  links.push({
    url: `https://${xr.status.myCustomField}`,
    title: 'My Custom Service',
    icon: 'Star',
  });
}
```

### Custom URL Transformation

For fields requiring special URL construction:

```typescript
// Example: Construct monitoring URL from cluster and namespace
if (xr.status.cluster && xr.status.namespace) {
  const monitoringUrl = `https://monitoring.example.com/cluster/${xr.status.cluster}/namespace/${xr.status.namespace}`;
  links.push({
    url: monitoringUrl,
    title: 'Cluster Monitoring',
    icon: 'Monitoring',
  });
}
```

### Protocol Handling

Add support for non-HTTP protocols:

```typescript
// Handle different protocols
if (xr.status.connectionString) {
  const conn = xr.status.connectionString;
  if (conn.startsWith('mongodb://')) {
    links.push({
      url: conn,
      title: 'MongoDB Connection',
      icon: 'Storage',
    });
  } else if (conn.startsWith('redis://')) {
    links.push({
      url: conn,
      title: 'Redis Connection',
      icon: 'Memory',
    });
  }
}
```

### Dynamic Icon Selection

Choose icons based on content:

```typescript
// Select icon based on URL pattern
function getIconForUrl(url: string): string {
  if (url.includes('dashboard')) return 'Dashboard';
  if (url.includes('api')) return 'Api';
  if (url.includes('admin')) return 'AdminPanelSettings';
  if (url.includes('monitor') || url.includes('grafana')) return 'Monitoring';
  return 'WebAsset';
}

// Use in link generation
links.push({
  url: statusUrl,
  title: extractTitle(statusUrl),
  icon: getIconForUrl(statusUrl),
});
```

## Best Practices

### For XR Authors

1. **Use Standard Fields**: Prefer standard field names for automatic detection
2. **Provide Metadata**: Use object format for better UX
3. **Include Icons**: Specify appropriate Material-UI icons
4. **Descriptive Titles**: Use clear, concise link titles
5. **Protocol Prefixes**: Always include protocol (https://, postgresql://, etc.)

### For Platform Teams

1. **Document Fields**: Document which status fields your XRs populate
2. **Consistent Naming**: Use consistent field names across XRs
3. **Test Links**: Verify generated links work correctly
4. **Monitor Ingestion**: Check logs for link generation issues
5. **Validate URLs**: Ensure URLs are properly formatted

### Example XRD with Status Schema

```yaml
apiVersion: apiextensions.crossplane.io/v1
kind: CompositeResourceDefinition
metadata:
  name: xpostgresqlinstances.platform.io
spec:
  versions:
  - name: v1alpha1
    schema:
      openAPIV3Schema:
        type: object
        properties:
          status:
            type: object
            properties:
              # Standard fields for automatic link generation
              domain:
                type: string
                description: Primary domain for the database
              endpoint:
                type: object
                description: Database connection details
                properties:
                  url:
                    type: string
                  title:
                    type: string
                  icon:
                    type: string
              externalURL:
                type: string
                description: Link to admin interface
              fqdn:
                type: string
                description: Fully qualified domain name
```

## Troubleshooting

### Links Not Appearing

1. **Check Status Fields**: Verify the resource has status fields
```bash
kubectl get xr my-resource -o jsonpath='{.status}' | jq
```

2. **Verify Ingestion**: Check the ingestor is running
```bash
kubectl logs -n backstage deployment/backstage | grep -i ingest
```

3. **Check Entity**: Verify links in the catalog entity
```bash
curl http://localhost:7007/api/catalog/entities?filter=metadata.name=my-resource | jq '.items[0].metadata.links'
```

### Incorrect URLs

1. **Protocol Issues**: Ensure fields include protocol if needed
2. **URL Encoding**: Special characters may need encoding
3. **Template Issues**: Check Composition is setting status correctly

### Performance Considerations

- Link generation is lightweight (no external calls)
- Processing happens during regular ingestion cycle
- No additional API calls or network requests
- Minimal memory overhead

## See Also

- [Architecture Overview](./architecture.md)
- [Configuration Reference](./configuration.md)
- [Testing Guide](../tests/README.md)
- [Crossplane Status Conventions](https://docs.crossplane.io/latest/concepts/composition/#status)