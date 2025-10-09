# Test Templates

Minimal, focused templates for testing XRD transform logic.

## Purpose

These templates are **NOT** meant to generate valid Backstage templates. They are simple, predictable structures used to test:

- Template rendering engine
- Variable substitution
- Conditional logic
- Multi-template composition
- Building block patterns

## Structure

```
tests/templates/
├── parameters/
│   ├── default.hbs         # Fallback when no annotation
│   └── basic.hbs           # Minimal parameters for testing
├── steps/
│   ├── default.hbs         # Fallback step
│   ├── direct.hbs          # Direct apply workflow
│   └── gitops.hbs          # GitOps workflow
└── output/
    ├── default.hbs         # Fallback output
    ├── direct.hbs          # Direct workflow output
    ├── gitops.hbs          # GitOps workflow output
    ├── block-download.hbs  # Reusable download block
    └── block-pr.hbs        # Reusable PR block
```

## Design Principles

1. **Minimal** - One-liners where possible
2. **Predictable** - Obvious test values (e.g., `test-url`, `test-action`)
3. **Focused** - Each template tests specific functionality
4. **Composable** - Building blocks for multi-template tests

## vs Production Templates

| Aspect | Test Templates | Production Templates |
|--------|---------------|---------------------|
| **Location** | `tests/templates/` | `templates/` |
| **Purpose** | Test transform logic | Generate valid Backstage templates |
| **Complexity** | Minimal one-liners | Full template structure |
| **Validation** | Not required | Must be valid YAML/Backstage |
| **Stability** | High - rarely change | May evolve with features |

## Usage

Test templates are used automatically when running feature tests:

```bash
./run-tests.sh --feature  # Uses tests/templates/
./run-tests.sh --e2e      # Uses production templates/
```

## Examples

### Minimal Test Template (parameters/basic.hbs)
```handlebars
- title: Simple Params
  properties:
    name:
      type: string
```

### Building Block (output/block-download.hbs)
```handlebars
links:
  - title: Download
    url: block-download-url
```

### Multi-Template Composition
```yaml
# In XRD fixture
annotations:
  openportal.dev/template-output: "block-download,block-pr"
```

This combines both blocks into a single output section.

## Adding Test Templates

1. Keep it minimal - test ONE thing
2. Use obvious test values
3. No complex logic unless testing that specific feature
4. Document in fixture what's being tested

## Test Fixtures

Feature test fixtures use these templates via annotations:

```yaml
# tests/xrd-transform/fixtures/feature-01-basic-namespaced.yaml
annotations:
  openportal.dev/template-parameters: "basic"
  openportal.dev/template-steps: "direct"
  openportal.dev/template-output: "direct"
```

E2E test fixtures use production templates from `../../templates/`.
