# XRD Transform Examples

This guide shows how to use the xrd-transform CLI to transform Crossplane XRDs into Backstage templates.

## Quick Start

### Transform an XRD from a file

```bash
# Navigate to the ingestor plugin directory
cd plugins/ingestor

# Transform template-namespace XRD
npx ts-node --project tsconfig.cli.json \
  src/xrd-transform/cli/xrd-transform-cli.ts \
  ../../../template-namespace/configuration/xrd.yaml
```

### Transform from stdin (pipe)

```bash
cat ../../../template-namespace/configuration/xrd.yaml | \
  npx ts-node --project tsconfig.cli.json \
  src/xrd-transform/cli/xrd-transform-cli.ts
```

### Save output to file

```bash
cat ../../../template-namespace/configuration/xrd.yaml | \
  npx ts-node --project tsconfig.cli.json \
  src/xrd-transform/cli/xrd-transform-cli.ts \
  > output.yaml
```

### Verbose mode (see what's happening)

```bash
npx ts-node --project tsconfig.cli.json \
  src/xrd-transform/cli/xrd-transform-cli.ts \
  ../../../template-namespace/configuration/xrd.yaml \
  -v
```

## Command Options

```bash
xrd-transform [options] [input]

Arguments:
  input                    Input file or directory (or stdin if not provided)

Options:
  -t, --templates <dir>    Template directory (defaults to built-in templates)
  -o, --output <dir>       Output directory (default: stdout)
  -f, --format <format>    Output format (yaml|json) (default: yaml)
  --single-file            Output all entities to a single file
  --organize               Organize output by entity type
  -v, --verbose            Verbose output
  --validate               Validate output
  --watch                  Watch for changes (when input is directory)
  -h, --help               Display help
```

## Example: template-namespace XRD

### Source XRD

```yaml
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: managednamespaces.openportal.dev
  labels:
    terasky.backstage.io/generate-form: "true"
  annotations:
    backstage.io/title: "ManagedNamespace Template"
    backstage.io/description: "Crossplane template for managing Kubernetes namespaces"
spec:
  group: openportal.dev
  names:
    kind: ManagedNamespace
    plural: managednamespaces
  versions:
    - name: v1alpha1
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              properties:
                name:
                  type: string
                  description: Name of the namespace to create
                  pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'
              required:
                - name
```

### Generated Output

The transform generates **two entities**:

#### 1. Backstage Template Entity

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: managednamespaces-openportal-dev
  title: ManagedNamespace Template
  description: Create and manage ManagedNamespace resources
  tags:
    - crossplane
    - openportal.dev
  annotations:
    backstage.io/managed-by: xrd-transform
    crossplane.io/xrd-name: managednamespaces.openportal.dev
    crossplane.io/xrd-group: openportal.dev
spec:
  owner: platform-team
  type: crossplane-resource

  # Wizard parameters extracted from XRD schema
  parameters:
    - title: Basic Information
      required:
        - name
        - namespace
      properties:
        name:
          title: Name
          type: string
          description: Name of the ManagedNamespace
          pattern: ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$
        namespace:
          title: Namespace
          type: string
          description: Kubernetes namespace
          default: default

    - title: Resource Configuration
      properties:
        name:
          title: Name
          type: string
          description: Name of the namespace to create
          pattern: ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$
      required:
        - name

  # Scaffolder steps
  steps:
    - id: create-resource
      name: Create ManagedNamespace
      action: kubernetes:apply
      input:
        manifest: |
          apiVersion: openportal.dev/v1alpha1
          kind: ManagedNamespace
          metadata:
            name: ${{ parameters.name }}
            namespace: ${{ parameters.namespace }}
          spec: ${{ parameters }}

    - id: register
      name: Register in Catalog
      action: catalog:register
      input:
        repoContentsUrl: ${{ steps.create-resource.output.repoContentsUrl }}
        catalogInfoPath: /catalog-info.yaml
```

#### 2. API Documentation Entity

```yaml
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: managednamespaces-openportal-dev-api
  title: ManagedNamespace Template API
  description: API specification for ManagedNamespace
  tags:
    - crossplane
    - ingestor
    - openportal.dev
spec:
  type: openapi
  lifecycle: v1alpha1
  owner: platform-team
  definition:
    openapi: 3.0.0
    info:
      title: ManagedNamespace API
      version: v1alpha1
      description: OpenAPI specification for ManagedNamespace
    paths:
      /managednamespaces:
        get:
          summary: List managednamespaces
        post:
          summary: Create ManagedNamespace
          requestBody:
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    spec:
                      type: object
                      description: ManagedNamespace configuration
                      properties:
                        name:
                          type: string
                          description: Name of the namespace to create
                          pattern: ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$
                      required:
                        - name
```

## Key Features Demonstrated

### 1. Property Extraction
The transform automatically:
- Extracts properties from XRD schema
- Generates appropriate UI fields
- Preserves validation rules (pattern, required, etc.)
- Creates proper parameter structure for Backstage

### 2. Metadata Generation
- Uses XRD name for template name
- Uses annotations for title/description
- Generates appropriate tags
- Links back to source XRD

### 3. Step Generation
- Creates kubernetes:apply action
- Injects template parameters
- Adds catalog registration step
- Uses proper Backstage variable syntax

### 4. API Documentation
- Generates OpenAPI 3.0 specification
- Documents all endpoints
- Includes schema definitions
- Links to XRD structure

## Custom Templates

You can customize the transformation by providing your own templates:

```bash
# Copy built-in templates
cp -r templates my-templates

# Edit templates
vim my-templates/backstage/default.hbs

# Use custom templates
npx ts-node --project tsconfig.cli.json \
  src/xrd-transform/cli/xrd-transform-cli.ts \
  -t my-templates \
  path/to/xrd.yaml
```

## Template Helpers

The templates have access to these helper functions:

- `slugify` - Convert text to URL-safe format
- `extractTitle` - Get human-readable title from XRD
- `extractProperties` - Parse XRD schema into properties
- `getAnnotation` - Get annotation value
- `getLabel` - Get label value
- `backstageVar` - Preserve Backstage template variables

### Example Template Usage

```handlebars
{{!-- Access XRD data --}}
name: {{slugify xrd.metadata.name}}
title: {{extractTitle xrd}}

{{!-- Extract properties from schema --}}
{{#each (extractProperties xrd)}}
  {{name}}:
    type: {{type}}
    {{#if description}}description: {{description}}{{/if}}
{{/each}}

{{!-- Preserve Backstage variables --}}
manifest: |
  metadata:
    name: {{backstageVar "parameters.name"}}
```

## Batch Processing

Transform multiple XRDs at once:

```bash
# Transform all XRDs in a directory
npx ts-node --project tsconfig.cli.json \
  src/xrd-transform/cli/xrd-transform-cli.ts \
  ../../../templates/ \
  -o ./generated-templates/ \
  --organize
```

## Watch Mode

Watch for changes and auto-regenerate:

```bash
npx ts-node --project tsconfig.cli.json \
  src/xrd-transform/cli/xrd-transform-cli.ts \
  ../../../templates/ \
  --watch \
  -v
```

## Integration with Plugin

The Backstage plugin uses the same transformation library:

```typescript
import { XRDTransformer } from './xrd-transform/lib/transform';

const transformer = new XRDTransformer();
const result = await transformer.transform(xrdData);
```

This ensures consistency between CLI and runtime transformations.

## Troubleshooting

### Template not found error
- Check that templates/ directory exists at package root
- Verify template files have .hbs extension
- Use -t flag to specify custom template directory

### Schema parsing issues
- Ensure XRD has valid openAPIV3Schema
- Check that properties are properly nested
- Validate XRD against Crossplane schema

### Variable syntax issues
- Backstage variables: `${{ parameters.name }}`
- Template variables: `{{xrd.metadata.name}}`
- Use `backstageVar` helper to preserve Backstage syntax

## See Also

- [XRD Transform Architecture](./xrd-transform-architecture.md)
- [Template Customization Guide](./template-customization.md)
- [Backstage Template Documentation](https://backstage.io/docs/features/software-templates/)
