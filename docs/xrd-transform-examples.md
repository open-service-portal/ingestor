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
  --only <type>            Only generate specific entity type (template|api)
  --single-file            Output all entities to a single file
  --organize               Organize output by entity type
  -v, --verbose            Verbose output
  --validate               Validate output
  --watch                  Watch for changes (when input is directory)
  -h, --help               Display help
```

## Filtering Output by Entity Type

Generate only specific entity types using `--only`:

### Generate Only Templates

```bash
# From workspace root
./scripts/xrd-transform.sh --only template template-namespace/configuration/xrd.yaml

# From plugin directory
npx ts-node --project tsconfig.cli.json \
  src/xrd-transform/cli/xrd-transform-cli.ts \
  --only template \
  ../../../template-namespace/configuration/xrd.yaml
```

Output: Only the Backstage Template entity (no API docs)

### Generate Only API Documentation

```bash
# From workspace root
./scripts/xrd-transform.sh --only api template-namespace/configuration/xrd.yaml

# From plugin directory
npx ts-node --project tsconfig.cli.json \
  src/xrd-transform/cli/xrd-transform-cli.ts \
  --only api \
  ../../../template-namespace/configuration/xrd.yaml
```

Output: Only the API entity (no Template)

### Use Cases for Filtering

**Generate templates only:**
- When you only need scaffolder templates
- When updating templates without regenerating API docs
- When batch-processing many XRDs for templates

**Generate API docs only:**
- When you only need OpenAPI specifications
- When documenting existing resources
- When integrating with API management tools

**Generate both (default):**
- When you want complete Backstage integration
- When creating initial catalog entries
- When you need both scaffolding and documentation

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

## Template Customization

### Annotation-Based Template Selection

XRDs can specify which templates to use via annotations:

```yaml
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: example.openportal.dev
  annotations:
    # Main template selection
    backstage.io/template: "default"              # Main backstage template (optional)
    backstage.io/template-api: "default"          # API doc template (optional)

    # Sub-template selection (modular architecture)
    backstage.io/template-parameters: "default"   # Parameters section (optional)
    backstage.io/template-steps: "default"        # Steps section (optional)
```

**Available Templates:**
- **backstage/** - Main Backstage Template entity structure
- **parameters/** - Scaffolder form parameters section
- **steps/** - Scaffolder workflow steps section
- **api/** - API documentation entity

### Template Architecture

The transform uses a modular template architecture:

1. **Main Template** (`templates/backstage/default.hbs`)
   - Defines the overall Backstage Template structure
   - Includes metadata, tags, annotations
   - Embeds rendered parameters and steps

2. **Parameters Template** (`templates/parameters/default.hbs`)
   - Generates the scaffolder form fields
   - Extracts properties from XRD schema
   - Defines validation rules

3. **Steps Template** (`templates/steps/default.hbs`)
   - Defines the scaffolder workflow
   - Creates kubernetes:apply actions
   - Handles catalog registration

4. **API Template** (`templates/api/default.hbs`)
   - Generates OpenAPI documentation
   - Documents resource endpoints
   - Includes schema definitions

### Template Helpers

The templates have access to these helper functions:

- `slugify` - Convert text to URL-safe format
- `extractTitle` - Get human-readable title from XRD
- `extractProperties` - Parse XRD schema into properties
- `getAnnotation` - Get annotation value
- `getLabel` - Get label value
- `backstageVar` - Preserve Backstage template variables
- `split` - Split comma-separated strings
- `trim` - Remove whitespace from strings

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

### Creating Custom Templates

To create custom templates for your XRDs:

1. **Copy the built-in templates:**
   ```bash
   cp -r templates my-custom-templates
   ```

2. **Modify the templates you want to customize:**
   ```bash
   # Custom parameters template for your XRD type
   vim my-custom-templates/parameters/database.hbs

   # Custom steps template for your workflow
   vim my-custom-templates/steps/gitops.hbs
   ```

3. **Use annotations in your XRD:**
   ```yaml
   apiVersion: apiextensions.crossplane.io/v2
   kind: CompositeResourceDefinition
   metadata:
     name: databases.platform.io
     annotations:
       backstage.io/template-parameters: "database"
       backstage.io/template-steps: "gitops"
   ```

4. **Transform with custom templates:**
   ```bash
   ./scripts/xrd-transform.sh -t my-custom-templates your-xrd.yaml
   ```

**Template Naming Convention:**
- Templates are named by their purpose (e.g., `database.hbs`, `gitops.hbs`)
- Place in appropriate directory: `parameters/`, `steps/`, `backstage/`, `api/`
- Always provide a `default.hbs` fallback in each directory

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
