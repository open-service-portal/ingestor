# Template Customization Guide

This guide explains how to customize the Handlebars templates used to generate Backstage templates from Crossplane XRDs.

## Overview

The ingestor plugin uses Handlebars templates to transform Crossplane XRDs into Backstage Template and API entities. By default, templates are bundled with the npm package, but you can customize them to fit your organization's needs.

## Template Structure

Templates are organized into specialized directories:

```
templates/
├── README.md              # Template development guide
├── backstage/            # Main template entity generation
│   ├── default.hbs       # Standard template
│   └── debug.hbs         # Debug output template
├── parameters/           # Parameter definitions
│   ├── default.hbs       # Standard parameters
│   └── gitops.hbs        # GitOps-specific parameters
├── steps/                # Scaffolder step definitions
│   ├── default.hbs       # Direct kube:apply steps
│   └── gitops.hbs        # PR-based GitOps workflow
├── output/               # Output panel templates
│   ├── default.hbs       # Basic output
│   ├── gitops.hbs        # GitOps with PR link
│   ├── download-manifest.hbs
│   ├── gitops-summary.hbs
│   └── pr-link.hbs
└── api/                  # API entity templates
    └── default.hbs       # API documentation
```

## Quick Start

### 1. Initialize Custom Templates

Using npm directly:
```bash
npx @open-service-portal/backstage-plugin-ingestor init
```

Or if using in a Backstage app with yarn scripts:
```bash
yarn ingestor:init
```

This creates `./ingestor-templates/` with all default templates.

### 2. Configure Template Directory

Add to `app-config/ingestor.yaml`:

```yaml
ingestor:
  crossplane:
    xrds:
      # Path to custom templates (relative to app root)
      templateDir: './ingestor-templates'

      # GitOps configuration (used by templates)
      gitops:
        owner: 'your-org'
        repo: 'catalog-orders'
        targetBranch: 'main'
```

### 3. Customize Templates

Edit templates in `./ingestor-templates/`:

```bash
# Customize the main Backstage template structure
vim ingestor-templates/backstage/default.hbs

# Customize GitOps workflow steps
vim ingestor-templates/steps/gitops.hbs

# Customize parameter definitions
vim ingestor-templates/parameters/default.hbs
```

### 4. Test Your Changes

```bash
# Test with CLI (uses configured templates)
npx @open-service-portal/backstage-plugin-ingestor path/to/xrd.yaml

# Or override for testing
npx @open-service-portal/backstage-plugin-ingestor \
  --template-path ./experimental-templates \
  path/to/xrd.yaml

# Test with Backstage (uses configured templates)
yarn start
```

## Configuration Priority

Templates are loaded with this priority:

1. **CLI flag** (CLI only): `--template-path ./custom`
2. **Config setting**: `ingestor.crossplane.xrds.templateDir`
3. **Built-in default**: Templates from npm package

This allows:
- **Production**: Use configured templates from `app-config.yaml`
- **Development**: Test experimental templates with CLI flag
- **Fallback**: Automatic use of built-in templates if none configured

## Template Contexts

Templates receive a rich context object:

```javascript
{
  xrd: {
    metadata: { name, annotations, labels },
    spec: {
      group,
      versions: [...],
      names: { kind, plural, singular },
      scope: 'Namespaced' | 'Cluster'
    }
  },
  properties: [
    { name, type, title, description, required, default, enum }
  ],
  config: {
    gitops: {
      owner: 'your-org',
      repo: 'catalog-orders',
      targetBranch: 'main'
    }
  },
  helpers: {
    slugify,
    extractTitle,
    extractDescription,
    // ... more helpers
  }
}
```

## Available Helpers

The templates include powerful Handlebars helpers:

### String Helpers
- `{{slugify str}}` - Convert to URL-safe slug
- `{{pascalCase str}}` - Convert to PascalCase
- `{{camelCase str}}` - Convert to camelCase

### Backstage Helpers
- `{{backstageVar "parameters.name"}}` - Generates `${{ parameters.name }}`
- `{{backstageConfigFallback "parameters.owner" config.gitops.owner}}` - With fallback

### XRD Helpers
- `{{extractTitle xrd}}` - Extract human-friendly title
- `{{extractDescription xrd}}` - Extract description from XRD

### Conditional Helpers
- `{{#if (eq scope "Namespaced")}}...{{/if}}`
- `{{#if (includes array value)}}...{{/if}}`

## Template Selection

Templates are selected via XRD annotations:

```yaml
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: dnsrecords.example.com
  annotations:
    # Select templates to use
    openportal.dev/template-steps: "gitops"        # Use gitops.hbs for steps
    openportal.dev/template-parameters: "gitops"   # Use gitops.hbs for parameters
    openportal.dev/template-output: "gitops"       # Use gitops.hbs for output
```

If annotations are not specified, `default.hbs` is used.

## Common Customizations

### Adding Organization Branding

```handlebars
{{!-- ingestor-templates/backstage/default.hbs --}}
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: {{slugify xrd.metadata.name}}
  title: {{extractTitle xrd}}
  tags:
    - crossplane
    - {{xrd.spec.group}}
    - your-org-tag  {{!-- Add custom tag --}}
  annotations:
    backstage.io/org: your-org  {{!-- Add org annotation --}}
```

### Customizing Parameter Validation

```handlebars
{{!-- ingestor-templates/parameters/default.hbs --}}
parameters:
  - title: Basic Information
    required:
      - name
      {{#if (eq xrd.spec.scope "Namespaced")}}
      - namespace  {{!-- Require namespace for namespaced resources --}}
      {{/if}}
    properties:
      name:
        title: Name
        type: string
        pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'
        minLength: 3  {{!-- Add custom validation --}}
        maxLength: 63
```

### Adding Custom Workflow Steps

```handlebars
{{!-- ingestor-templates/steps/default.hbs --}}
steps:
  - id: validate-input
    name: Validate Configuration
    action: your-org:validate
    input:
      resourceType: {{xrd.spec.names.kind}}

  - id: create-resource
    name: Create {{xrd.spec.names.kind}}
    action: kubernetes:apply
    input:
      manifest: |
        # ... resource manifest
```

## Testing Template Changes

### 1. Regression Testing

Use the test infrastructure:

```bash
cd ingestor
./run-tests.sh
```

### 2. Manual Testing

```bash
# Transform a real XRD
npx @open-service-portal/backstage-plugin-ingestor \
  path/to/real-xrd.yaml > generated-template.yaml

# Review the output
cat generated-template.yaml

# Test in Backstage
yarn start
# Navigate to http://localhost:3000/create
```

### 3. Validation

```bash
# Validate without outputting
npx @open-service-portal/backstage-plugin-ingestor \
  --validate \
  path/to/xrd.yaml
```

## Version Control Best Practices

1. **Commit Custom Templates**
   ```bash
   git add ingestor-templates/
   git commit -m "feat: customize XRD templates for our org"
   ```

2. **Review Template Changes**
   - Create PRs for template modifications
   - Test with real XRDs before merging
   - Document customization rationale

3. **Track Template Versions**
   - Add version comments in templates
   - Link to relevant issues/tickets
   - Document breaking changes

## Upgrading Templates

When upgrading the ingestor plugin:

1. **Review Changelog**
   - Check for template improvements
   - Note new helpers or context fields

2. **Reinitialize (Optional)**
   ```bash
   # Save your customizations
   cp -r ingestor-templates ingestor-templates.backup

   # Get latest default templates
   npx @open-service-portal/backstage-plugin-ingestor init --force

   # Merge your customizations
   # Compare and merge manually
   ```

3. **Test Thoroughly**
   - Run regression tests
   - Test with representative XRDs
   - Verify in Backstage UI

## Troubleshooting

### Templates Not Loading

**Symptom**: Built-in templates used instead of custom ones

**Solution**:
```bash
# Verify templateDir is set
cat app-config/ingestor.yaml | grep templateDir

# Check path is correct (relative to app root)
ls -la ingestor-templates/

# Restart Backstage
yarn start
```

### Template Syntax Errors

**Symptom**: Transform fails with Handlebars errors

**Solution**:
```bash
# Enable verbose mode
npx @open-service-portal/backstage-plugin-ingestor \
  --verbose \
  path/to/xrd.yaml

# Check for:
# - Unclosed {{#if}} blocks
# - Invalid helper usage
# - Incorrect context paths
```

### Missing Context Variables

**Symptom**: Template generates empty values

**Solution**:
```bash
# Use debug template to see full context
npx @open-service-portal/backstage-plugin-ingestor \
  --template debug \
  path/to/xrd.yaml

# Review available context fields
# Update template to use correct paths
```

## Examples

See the [templates/README.md](../templates/README.md) for:
- Template development guide
- Example customizations
- Helper function reference
- Best practices

## Support

For questions or issues:
- Check [XRD Transform Examples](./xrd-transform-examples.md)
- Review [Template README](../templates/README.md)
- File issues at https://github.com/open-service-portal/ingestor/issues
