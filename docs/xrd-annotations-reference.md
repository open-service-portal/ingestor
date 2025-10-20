# XRD Annotations Reference

This document provides a complete reference of annotations that control how Crossplane XRDs are transformed into Backstage templates.

## Overview

The ingestor plugin uses annotations on XRDs to control template generation, metadata, and behavior. Annotations provide a declarative way to customize the transformation without modifying code.

## Template Selection Annotations

These annotations control which Handlebars templates are used during transformation.

### `backstage.io/template`

**Purpose:** Specifies the main Backstage Template entity structure template.

**Default:** `default`

**Location:** `templates/backstage/{value}.hbs`

**Example:**
```yaml
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: databases.platform.io
  annotations:
    backstage.io/template: "default"
```

**Use Cases:**
- Use `default` for standard Crossplane resource templates
- Create custom template for specific entity structures
- Override metadata, tags, or spec sections

---

### `openportal.dev/template-api`

**Purpose:** Specifies the API documentation entity template.

**Default:** `default`

**Location:** `templates/api/{value}.hbs`

**Example:**
```yaml
metadata:
  annotations:
    openportal.dev/template-api: "openapi-v3"
```

**Use Cases:**
- Generate OpenAPI documentation from XRD schema
- Customize API entity structure
- Add specific documentation sections

---

### `openportal.dev/template-parameters`

**Purpose:** Specifies the template for scaffolder form parameters.

**Default:** `default`

**Location:** `templates/parameters/{value}.hbs`

**Example:**
```yaml
metadata:
  annotations:
    openportal.dev/template-parameters: "database"
```

**Use Cases:**
- Custom form layouts for specific resource types
- Database configuration forms with specialized fields
- Storage provisioning with capacity calculators
- Network configuration with CIDR validation

**Example Templates:**
- `database` - Database-specific fields (engine, size, backup settings)
- `storage` - Storage provisioning fields (capacity, tier, encryption)
- `network` - Network configuration (CIDR, VPC, subnets)

---

### `openportal.dev/template-steps`

**Purpose:** Specifies the template for scaffolder workflow steps.

**Default:** `default`

**Location:** `templates/steps/{value}.hbs`

**Example:**
```yaml
metadata:
  annotations:
    openportal.dev/template-steps: "gitops"
```

**Use Cases:**
- GitOps workflows with PR creation
- Multi-step provisioning (create → configure → validate)
- Custom approval workflows
- Integration with external systems

**Example Templates:**
- `gitops` - Create PR for resource definition
- `approval` - Add approval step before provisioning
- `multi-cluster` - Deploy to multiple clusters
- `validation` - Validate and test before creation

## Metadata Annotations

These annotations provide metadata about the XRD and generated entities.

### `backstage.io/title`

**Purpose:** Human-readable title for the generated template.

**Default:** Extracted from XRD name (via `extractTitle` helper)

**Example:**
```yaml
metadata:
  annotations:
    backstage.io/title: "PostgreSQL Database"
```

**Generated Output:**
```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  title: PostgreSQL Database
```

---

### `backstage.io/description`

**Purpose:** Description for the generated template.

**Default:** `"Create and manage {XRD kind} resources"`

**Example:**
```yaml
metadata:
  annotations:
    backstage.io/description: "Provision and manage PostgreSQL databases with automatic backups"
```

**Generated Output:**
```yaml
metadata:
  description: Provision and manage PostgreSQL databases with automatic backups
```

---

### `backstage.io/owner`

**Purpose:** Team or user who owns the template.

**Default:** `platform-team`

**Example:**
```yaml
metadata:
  annotations:
    backstage.io/owner: "database-team"
```

**Generated Output:**
```yaml
spec:
  owner: database-team
```

## Tag Annotations

### `openportal.dev/tags`

**Purpose:** Comma-separated list of tags for categorization.

**Default:** Only includes `crossplane` and XRD group

**Example:**
```yaml
metadata:
  annotations:
    openportal.dev/tags: "database,postgresql,storage,production"
```

**Generated Output:**
```yaml
metadata:
  tags:
    - crossplane
    - platform.io
    - database
    - postgresql
    - storage
    - production
```

**Best Practices:**
- Use lowercase tags
- Include resource category (database, storage, network)
- Include technology (postgresql, mysql, redis)
- Include environment if applicable (production, development)
- Keep tags consistent across similar resources

## Discovery and Filtering Annotations

### `terasky.backstage.io/generate-form`

**Purpose:** Mark XRD for template generation (legacy label, kept for compatibility).

**Type:** Label (not annotation)

**Example:**
```yaml
metadata:
  labels:
    terasky.backstage.io/generate-form: "true"
```

**Note:** In the current system, all XRDs matching the plugin's configuration are processed. This label is optional but can be used for explicit opt-in.

## Complete Example

Here's a complete XRD with all relevant annotations:

```yaml
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: postgresqldatabases.platform.io
  labels:
    terasky.backstage.io/generate-form: "true"
  annotations:
    # Template Selection
    openportal.dev/template: "default"
    openportal.dev/template-api: "default"
    openportal.dev/template-parameters: "database"
    openportal.dev/template-steps: "gitops"

    # Metadata
    backstage.io/title: "PostgreSQL Database"
    backstage.io/description: "Provision managed PostgreSQL databases with automatic backups and monitoring"
    backstage.io/owner: "database-team"

    # Tags
    openportal.dev/tags: "database,postgresql,storage,rds,production"
spec:
  group: platform.io
  names:
    kind: PostgreSQLDatabase
    plural: postgresqldatabases
  versions:
    - name: v1alpha1
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                engine:
                  type: string
                  description: PostgreSQL version
                  enum: ["14", "15", "16"]
                  default: "16"
                storageGB:
                  type: integer
                  description: Database storage in GB
                  minimum: 20
                  maximum: 16384
                  default: 100
              required:
                - engine
                - storageGB
```

This XRD will:
- Use the `database` parameters template for a database-specific form
- Use the `gitops` steps template to create a PR instead of direct apply
- Be titled "PostgreSQL Database" in the catalog
- Be owned by the `database-team`
- Be tagged with database-related categories

## Custom Template Creation

To use custom templates referenced by annotations:

1. **Create template directory:**
   ```bash
   mkdir -p my-templates/parameters
   mkdir -p my-templates/steps
   ```

2. **Create custom template:**
   ```bash
   vim my-templates/parameters/database.hbs
   ```

3. **Configure plugin** (in `app-config.yaml`):
   ```yaml
   kubernetesIngestor:
     crossplane:
       xrds:
         templateDir: ./my-templates
   ```

4. **Use in XRD:**
   ```yaml
   metadata:
     annotations:
       openportal.dev/template-parameters: "database"
   ```

## CLI Usage with Annotations

When using the xrd-transform CLI, annotations are automatically processed:

```bash
# Transform uses annotations from XRD
./scripts/xrd-transform.sh xrd-with-annotations.yaml

# Override template directory
./scripts/xrd-transform.sh -t custom-templates xrd.yaml

# Generate only specific entity type
./scripts/xrd-transform.sh --only template xrd.yaml
```

## Fallback Behavior

If an annotation is not specified or references a non-existent template:

1. **Template not found:** Falls back to `default.hbs` in the same directory
2. **No default.hbs:** Error is thrown with clear message
3. **Invalid annotation value:** Uses default value

**Example Error:**
```
Error: parameters template not found: custom-db (and no default.hbs)
```

**Solution:** Create the template or remove the annotation to use default.

## Validation

The plugin validates:
- Template file existence
- Template syntax (Handlebars compilation)
- YAML output from templates
- Required XRD schema fields

Validation errors are logged and prevent entity creation.

## See Also

- [XRD Transform Examples](./xrd-transform-examples.md) - Usage examples
- [Architecture Documentation](./architecture.md) - System design
- [Template Development](../templates/README.md) - Creating custom templates
- [Quick Start Guide](./quick-start.md) - Getting started
