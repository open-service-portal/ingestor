# XRD Transform Templates

This directory contains Handlebars templates for transforming Crossplane XRDs into Backstage entities.

## Directory Structure

```
templates/
├── backstage/          # Main Backstage Template entity structure
│   └── default.hbs     # Default template structure
├── parameters/         # Scaffolder form parameters
│   ├── default.hbs     # Scope-aware parameters (works for both namespaced and cluster-scoped)
│   └── gitops.hbs      # GitOps parameters with runtime override fields
├── steps/              # Scaffolder workflow steps
│   ├── default.hbs     # Direct kube:apply workflow (works for both scopes)
│   └── gitops.hbs      # GitOps PR workflow with three-level config support
└── api/                # API documentation entities
    └── default.hbs     # Default OpenAPI documentation
```

### Recent Updates

- **Three-Level Configuration**: User parameters → XRD annotations → Global config hierarchy
- **GitOps Parameters Template**: New `gitops.hbs` enables runtime GitOps configuration overrides
- **Unified Templates**: `default.hbs` templates handle both namespaced and cluster-scoped resources
- **GitOps Workflow**: `gitops.hbs` with three-level config fallback support
- **Configuration-Driven**: Templates use configuration from `app-config/ingestor.yaml`
- **XRD-Level Overrides**: `openportal.dev/parameter.*` annotations for per-template defaults
- **TechDocs Integration**: Automatic `backstage.io/techdocs-ref` annotation passthrough
- **Triple-Brace Fix**: Backstage variables use `{{{...}}}` to prevent HTML escaping

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
    backstage.io/template-api: "default"          # API docs
    backstage.io/template-parameters: "default"   # Form fields
    backstage.io/template-steps: "default"        # Workflow
```

### 3. Available Variables

All templates have access to:

```typescript
{
  xrd: any,                    // Full XRD object
  metadata: {                  // Extraction metadata
    cluster?: string,          // Current kubectl context (auto-detected)
    namespace?: string,
    path?: string,
  },
  config: {                    // Configuration from app-config/ingestor.yaml
    gitops: {                  // GitOps workflow settings
      ordersRepo: {
        owner: string,         // GitHub org/user
        repo: string,          // Repository name
        targetBranch: string,  // Target branch (e.g., 'main')
      }
    }
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

### 4. Configuration

Templates can access configuration from `app-config/ingestor.yaml`:

```yaml
# app-config/ingestor.yaml
kubernetesIngestor:
  crossplane:
    xrds:
      gitops:
        ordersRepo:
          owner: 'your-org'
          repo: 'catalog-orders'
          targetBranch: 'main'
```

Access in templates:

```handlebars
repoUrl: github.com?owner={{config.gitops.ordersRepo.owner}}&repo={{config.gitops.ordersRepo.repo}}
targetBranchName: {{config.gitops.ordersRepo.targetBranch}}
```

**Validation**: GitOps templates (those with "gitops" in the name) require this configuration. The CLI validates and fails fast with helpful error messages if config is missing.

### 5. XRD-Level Configuration Overrides

Individual XRDs can override global GitOps configuration using parameter annotations:

```yaml
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: databases.example.com
  annotations:
    openportal.dev/template-steps: "gitops"

    # Override global GitOps settings for this XRD only
    openportal.dev/parameter.gitopsOwner: "database-team"
    openportal.dev/parameter.gitopsRepo: "database-orders"
    openportal.dev/parameter.gitopsTargetBranch: "staging"
```

**Pattern**: `openportal.dev/parameter.<parameterName>: <value>`

This sets default values for template parameters. These annotations:
- Override global config from `app-config/ingestor.yaml`
- Are overridden by user input in the UI form
- Work for ANY parameter, not just GitOps config

**Configuration Hierarchy** (highest to lowest priority):
1. **User parameter input** (runtime, via UI form) - **HIGHEST** priority, ultimate user control
2. **XRD annotation** (`openportal.dev/parameter.*`) - Per-template parameter defaults
3. **Global config** (`app-config/ingestor.yaml`) - **LOWEST** priority, default fallback

**Use Cases:**
- **User parameters**: Ad-hoc testing, personal forks, temporary branches
- **XRD annotation**: Team-specific repositories, resource-type workflows
- **Global config**: Organization-wide defaults

### 6. User Parameter Overrides

To enable users to override GitOps configuration at runtime, use the `gitops` parameters template:

```yaml
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: example.openportal.dev
  annotations:
    openportal.dev/template-steps: "gitops"
    openportal.dev/template-parameters: "gitops"  # Enable parameter overrides
```

This adds an "Advanced GitOps Configuration" section to the form with:
- `gitopsOwner` - Override GitHub organization/user
- `gitopsRepo` - Override repository name
- `gitopsTargetBranch` - Override target branch

Users can leave these empty to use defaults, or override them for specific needs (testing, personal forks, etc.).

**Benefits:**
- Three-level configuration hierarchy with clear precedence
- Users have ultimate control when needed
- Templates define sensible per-resource defaults
- Global config provides organization-wide consistency
- Testable at all levels (CLI, XRD annotation, runtime parameters)

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
    backstage.io/template-parameters: "database"
```

### Example: GitOps PR Workflow

The built-in `gitops.hbs` template demonstrates the GitOps pattern:

```handlebars
    - id: generateManifest
      name: Generate Kubernetes Resource Manifest
      action: terasky:claim-template
      input:
        parameters: {{backstageVar "parameters"}}
        nameParam: name
        namespaceParam: {{#if (eq xrd.spec.scope "Namespaced")}}'namespace'{{else}}''{{/if}}
        ownerParam: owner
        excludeParams:
          - owner
          - name
          - namespace
        apiVersion: {{xrd.spec.group}}/{{xrd.spec.versions.[0].name}}
        kind: {{xrd.spec.names.kind}}
        clusters: ['{{metadata.cluster}}']
        removeEmptyParams: true

    - id: create-pull-request
      name: Create Pull Request
      action: publish:github:pull-request
      input:
        repoUrl: github.com?owner={{config.gitops.ordersRepo.owner}}&repo={{config.gitops.ordersRepo.repo}}
        branchName: {{{backstageVar "\"create-\" + parameters.name + \"-resource\""}}}
        title: {{{backstageVar "\"Create \" + parameters.name + \" Resource\""}}}
        description: {{{backstageVar "\"Create \" + xrd.spec.names.kind + \" resource \" + parameters.name"}}}
        targetBranchName: {{config.gitops.ordersRepo.targetBranch}}
```

**Key Features:**
- Uses `terasky:claim-template` for manifest generation
- Gets repo config from `app-config/ingestor.yaml`
- Auto-detects cluster from kubectl context
- Handles both namespaced and cluster-scoped resources
- Creates PRs to catalog-orders repository

Use in your XRD:

```yaml
metadata:
  annotations:
    openportal.dev/template-steps: "gitops"
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

### 2. HTML Escaping: When to Use Triple-Braces

**Important**: Handlebars escapes HTML entities by default with `{{...}}`. Use `{{{...}}}` (triple braces) to output raw values.

**Use triple-braces for:**
- Backstage variables containing quotes: `{{{backstageVar "\"text\""}}}`
- Pre-rendered template content: `{{{parametersRendered}}}`
- Any value that should not be HTML-escaped

**Example - Correct:**
```handlebars
branchName: {{{backstageVar "\"create-\" + parameters.name"}}}
# Output: branchName: ${{ "create-" + parameters.name }}
```

**Example - Incorrect:**
```handlebars
branchName: {{backstageVar "\"create-\" + parameters.name"}}
# Output: branchName: ${{ &quot;create-&quot; + parameters.name }}  ❌
```

**Use double-braces for:**
- Simple property access: `{{config.gitops.ordersRepo.owner}}`
- XRD fields: `{{xrd.spec.group}}`
- Values without special characters

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

## Debug Template

A special `debug` template is provided to inspect all available variables during transformation:

### Usage

1. **Add annotation to XRD:**
   ```yaml
   metadata:
     annotations:
       backstage.io/template: "debug"
   ```

2. **Transform the XRD:**
   ```bash
   ./scripts/xrd-transform.sh your-xrd.yaml
   ```

3. **Review output:**
   The generated template will include an `output` section showing:
   - All XRD metadata (name, labels, annotations)
   - XRD spec (group, names, versions)
   - Extraction metadata (cluster, source, timestamp)
   - Helper function examples with actual output
   - Extracted properties from schema
   - Template configuration from annotations
   - Usage guide with examples

### Example Output

```yaml
spec:
  output:
    xrd_metadata:
      name: databases.platform.io
    xrd_spec:
      group: platform.io
      names:
        kind: Database
        plural: databases
    helper_examples:
      slugify: databases-platform-io
      extractTitle: Database Template
      getAnnotation_template: debug
    extracted_properties:
      count: 3
      properties:
        - name: engine
          type: string
          required: true
```

### Use Cases

- **Template Development**: Understand what data is available
- **Debugging**: Investigate why a template isn't working
- **Learning**: See how helpers transform data
- **Documentation**: Generate examples of available variables

## See Also

- [XRD Transform Examples](../docs/xrd-transform-examples.md) - Complete usage guide
- [XRD Annotations Reference](../docs/xrd-annotations-reference.md) - All annotation options
- [Architecture Documentation](../docs/architecture.md) - Technical details
- [Backstage Template Documentation](https://backstage.io/docs/features/software-templates/) - Official docs
