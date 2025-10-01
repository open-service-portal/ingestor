# XRD Transform Templates

This directory contains Handlebars templates for transforming Crossplane XRDs into Backstage entities.

## Directory Structure

```
templates/
├── backstage/          # Main Backstage Template entity structure
│   └── default.hbs     # Default template structure
├── parameters/         # Scaffolder form parameters
│   └── default.hbs     # Default parameters extraction
├── steps/              # Scaffolder workflow steps
│   └── default.hbs     # Default kubernetes:apply workflow
└── api/                # API documentation entities
    └── default.hbs     # Default OpenAPI documentation
```

## How Templates Work

### 1. Modular Architecture

The transform uses a multi-stage rendering process:

1. **Parameters Template** is rendered first → produces form fields
2. **Steps Template** is rendered second → produces workflow
3. **Main Template** combines everything → produces final entity

### 2. Template Selection

XRDs specify which templates to use via annotations:

```yaml
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: example.openportal.dev
  annotations:
    backstage.io/template: "default"              # Main template
    backstage.io/api-template: "default"          # API docs
    backstage.io/parameters-template: "default"   # Form fields
    backstage.io/steps-template: "default"        # Workflow
```

### 3. Available Variables

All templates have access to:

```typescript
{
  xrd: any,                    // Full XRD object
  metadata: {                  // Extraction metadata
    cluster?: string,
    namespace?: string,
    path?: string,
  },
  helpers: {                   // Utility functions
    slugify,
    extractTitle,
    extractProperties,
    getAnnotation,
    getLabel,
  },
  source: string,              // Where XRD came from
  timestamp: string,           // When extracted
}
```

Additionally, the main template receives:

```typescript
{
  parametersRendered: string,  // Pre-rendered parameters section
  stepsRendered: string,       // Pre-rendered steps section
}
```

## Creating Custom Templates

### Example: Custom Database Parameters

Create `parameters/database.hbs`:

```handlebars
    - title: Database Configuration
      required:
        - name
        - engine
        - storage
      properties:
        name:
          title: Database Name
          type: string
          pattern: '^[a-z0-9-]+$'
        engine:
          title: Database Engine
          type: string
          enum:
            - postgres
            - mysql
            - mongodb
        storage:
          title: Storage Size (GB)
          type: number
          minimum: 10
          maximum: 1000
          default: 20
```

Then use it in your XRD:

```yaml
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: databases.platform.io
  annotations:
    backstage.io/parameters-template: "database"
```

### Example: Custom GitOps Steps

Create `steps/gitops.hbs`:

```handlebars
    - id: create-resource
      name: Create {{xrd.spec.names.kind}}
      action: kubernetes:apply
      input:
        manifest: |
          apiVersion: {{xrd.spec.group}}/{{xrd.spec.versions.[0].name}}
          kind: {{xrd.spec.names.kind}}
          metadata:
            name: {{backstageVar "parameters.name"}}
            namespace: {{backstageVar "parameters.namespace"}}
          spec: {{backstageVar "parameters"}}

    - id: create-pr
      name: Create Pull Request
      action: publish:github:pull-request
      input:
        repoUrl: {{backstageVar "parameters.repoUrl"}}
        branchName: {{backstageVar "parameters.name"}}-config
        title: Add {{xrd.spec.names.kind}} resource
        description: Creates a new {{xrd.spec.names.kind}} resource

    - id: register
      name: Register in Catalog
      action: catalog:register
      input:
        repoContentsUrl: {{backstageVar "steps.create-pr.output.remoteUrl"}}
        catalogInfoPath: /catalog-info.yaml
```

## Helper Functions

### Built-in Helpers

- `{{slugify text}}` - Convert to URL-safe format
- `{{extractTitle xrd}}` - Get human-readable title
- `{{extractProperties xrd}}` - Parse schema properties
- `{{getAnnotation xrd "key"}}` - Get annotation value
- `{{getLabel xrd "key"}}` - Get label value
- `{{backstageVar "path"}}` - Preserve Backstage variable syntax
- `{{split string ","}}` - Split by delimiter
- `{{trim string}}` - Remove whitespace
- `{{json object}}` - JSON stringify
- `{{eq a b}}` - Equality comparison
- `{{includes array value}}` - Array includes check

### Example Usage

```handlebars
{{!-- Title extraction --}}
title: {{extractTitle xrd}}

{{!-- Property iteration --}}
{{#each (extractProperties xrd)}}
{{name}}:
  type: {{type}}
  {{#if description}}description: {{description}}{{/if}}
{{/each}}

{{!-- Conditional rendering --}}
{{#if (getAnnotation xrd "backstage.io/owner")}}
owner: {{getAnnotation xrd "backstage.io/owner"}}
{{else}}
owner: platform-team
{{/if}}

{{!-- Tag parsing --}}
{{#each (split (getAnnotation xrd "openportal.dev/tags") ",")}}
  - {{trim this}}
{{/each}}

{{!-- Backstage variable preservation --}}
name: {{backstageVar "parameters.name"}}
```

## Template Development Tips

### 1. Maintain Proper Indentation

YAML requires precise indentation. Sub-templates should include their indentation:

```handlebars
    - title: My Section
      properties:
        field:
          type: string
```

### 2. Use Triple-Braces for Pre-Rendered Content

When embedding pre-rendered templates, use `{{{ }}}` to prevent escaping:

```handlebars
  parameters:
{{{parametersRendered}}}

  steps:
{{{stepsRendered}}}
```

### 3. Test Your Templates

```bash
# Test with a specific XRD
./scripts/xrd-transform.sh -t ./my-templates your-xrd.yaml

# Use verbose mode to see errors
./scripts/xrd-transform.sh -t ./my-templates -v your-xrd.yaml
```

### 4. Always Provide a Default

Each template directory should have a `default.hbs` fallback:

```
templates/
├── parameters/
│   ├── default.hbs     # ← Always required
│   ├── database.hbs
│   └── storage.hbs
```

## See Also

- [XRD Transform Examples](../docs/xrd-transform-examples.md) - Complete usage guide
- [XRD Transform Architecture](../docs/xrd-transform-architecture.md) - Technical details
- [Backstage Template Documentation](https://backstage.io/docs/features/software-templates/) - Official docs
