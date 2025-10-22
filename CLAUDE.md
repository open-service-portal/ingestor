# CLAUDE.md - Ingestor Plugin

This file provides guidance to Claude Code when working with the Backstage Ingestor Plugin.

## Quick Reference

### Project Structure

```
plugins/ingestor/
├── src/                          # Source code
│   ├── lib/                      # Core ingestion engine
│   ├── adapters/                 # Environment adapters
│   ├── xrd-transform/            # XRD transform module
│   │   └── cli/                  # XRD transform CLI
│   ├── backstage-export/         # Backstage export module
│   │   └── cli/                  # Export CLI
│   └── module.ts                 # Backend module registration
├── bin/                          # npm bin scripts
│   ├── ingestor                  # XRD transform entry point
│   └── backstage-export          # Export entry point
├── scripts/                      # Shell wrappers
│   ├── xrd-transform.sh          # XRD transform wrapper → bin/ingestor
│   └── backstage-export.sh       # Export wrapper → bin/backstage-export
├── templates/                    # Production Handlebars templates
│   ├── backstage/default.hbs     # Main template structure
│   ├── parameters/               # Parameter templates
│   ├── steps/                    # Step templates (direct, gitops)
│   ├── output/                   # Output templates (download, pr, summary)
│   └── README.md                 # Template documentation
├── tests/                        # Test suite (flattened structure)
│   ├── output/                   # Generated test outputs (gitignored)
│   ├── templates/                # Minimal test templates
│   ├── scope/                    # Scenario: Resource scope
│   │   ├── test-namespaced.yaml  # Test fixture
│   │   └── assert-namespaced.yaml # Expected output
│   ├── multi-templates/          # Scenario: Multi-template composition
│   └── ...                       # More scenarios
├── run-tests.sh                  # Test runner (discovers all scenarios)
├── tsconfig.cli.json             # TypeScript config for CLI (CommonJS)
└── docs/                         # Comprehensive documentation
```

**CLI Architecture:**
- **Bin scripts** (`bin/*`) - npm entry points, configure ts-node with tsconfig.cli.json
- **Shell wrappers** (`scripts/*`) - path resolution, auto-detection, delegate to bin scripts
- **TypeScript CLIs** (`src/*/cli/*`) - actual CLI implementation using Commander.js

## Development Commands

### Testing

```bash
# Run XRD transform regression tests
./run-tests.sh

# Expected output: All scenarios pass
# ═══════════════════════════════════════════════════════════
#   Summary
# ═══════════════════════════════════════════════════════════
# Scenarios: 2
# Total:     3
# Passed:    3
# Failed:    0
```

**Test Structure:**
- `tests/<scenario>/test-<case>.yaml` - Test fixtures
- `tests/<scenario>/assert-<case>.yaml` - Expected outputs
- `tests/output/` - Generated outputs (gitignored)
- `tests/templates/` - Minimal test templates (fast, focused)
```

### XRD Transformation (Template Ingestion)

```bash
# Transform XRD to Backstage template
./scripts/xrd-transform.sh path/to/xrd.yaml

# With output to file
./scripts/xrd-transform.sh path/to/xrd.yaml > template.yaml

# Debug mode (shows verbose output)
./scripts/xrd-transform.sh -t debug path/to/xrd.yaml

# Validate mode (checks without outputting)
./scripts/xrd-transform.sh -v path/to/xrd.yaml

# Specify output directory
./scripts/xrd-transform.sh -o ./output/ path/to/xrd.yaml
```

### Backstage Export (Template Export)

```bash
# Export all templates from Backstage
./scripts/backstage-export.sh --kind Template

# Export with filters
./scripts/backstage-export.sh --kind Template --tags crossplane --organize

# Preview what would be exported
./scripts/backstage-export.sh --preview --kind Template,API

# List entities only
./scripts/backstage-export.sh --list --kind API

# Export with custom output
./scripts/backstage-export.sh --kind Template -o ./my-exports --manifest
```

## Testing XRD Transforms

### Test Script Location

The test runner is located at **`./run-tests.sh`** in the plugin root directory.

**Key paths (relative to plugin root):**
- **Transform script**: `./scripts/xrd-transform.sh`
- **Test fixtures**: `./tests/xrd-transform/fixtures/`
- **Expected outputs**: `./tests/xrd-transform/expected/`
- **Generated outputs**: `./tests/xrd-transform/output/` (gitignored)

### Running Tests

```bash
# From plugin root (recommended)
./run-tests.sh

# From workspace root
cd app-portal/plugins/ingestor && ./run-tests.sh
```

### Test Coverage

The regression test suite validates:

- ✅ **Namespaced resources** - Includes namespace parameter
- ✅ **Cluster-scoped resources** - No namespace parameter
- ✅ **Parameter annotations** - `openportal.dev/parameter.*` overrides
- ✅ **GitOps workflows** - PR-based resource creation
- ✅ **Default workflows** - Direct `kube:apply` step
- ✅ **Complex properties** - Arrays, objects, booleans, integers
- ✅ **Template generation** - Both Template and API entities
- ✅ **Configuration hierarchy** - 3-level config override system

### Adding New Tests

```bash
# 1. Create test fixture
cat > tests/xrd-transform/fixtures/09-my-test.yaml <<EOF
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: myresources.example.com
spec:
  # ... XRD spec
EOF

# 2. Generate expected output
./scripts/xrd-transform.sh \
  tests/xrd-transform/fixtures/09-my-test.yaml \
  > tests/xrd-transform/expected/09-my-test.yaml

# 3. Review the generated output
cat tests/xrd-transform/expected/09-my-test.yaml | less

# 4. Run tests
./run-tests.sh
```

### Updating Expected Outputs

**⚠️ CRITICAL RULE:** Only update expected outputs when you have intentionally changed behavior!

**NEVER overwrite entire assert files!** Only modify the specific sections that changed. This preserves:
- Test documentation headers
- Unaffected test content
- Git history clarity

```bash
# 1. Run tests to see differences
./run-tests.sh

# 2. Review each diff carefully - understand WHY the output changed

# 3. Make SURGICAL edits to assert files (PREFERRED METHOD)
# Read the assert file first
cat tests/e2e/assert-namespace.yaml

# Edit ONLY the changed section (e.g., adding labels field)
# Use your editor to add/modify only the specific lines that need updating
# DO NOT copy the entire output file over the assert file!

# 4. If you must copy (last resort), restore from git first:
git checkout tests/e2e/assert-namespace.yaml  # Get clean version
# Then make only the minimal change needed

# 5. Verify the change is minimal
git diff tests/e2e/assert-namespace.yaml

# 6. Document the change in your commit message
git commit -m "fix: add version label support to template transformation"
```

**Why this matters:**
- Assert files contain important documentation headers explaining the test purpose
- Full file overwrites lose these headers and break the test infrastructure
- Surgical edits preserve context and make changes reviewable
- Git diffs become meaningful when only relevant lines change

**Never blindly regenerate all expected files!** Each change should be reviewed, understood, and applied surgically.

## CLI Architecture

### Bin Scripts + Shell Wrappers Pattern

The plugin uses a dual-layer architecture for CLI tools:

#### Layer 1: Bin Scripts (`bin/`)

**Purpose:** npm package entry points that work when plugin is installed

```javascript
// bin/ingestor
#!/usr/bin/env node
require('ts-node').register({
  project: require('path').join(__dirname, '..', 'tsconfig.cli.json')
});
require('../src/xrd-transform/cli/xrd-transform-cli');
```

**Key aspects:**
- Explicitly configure ts-node with `tsconfig.cli.json`
- Use CommonJS module resolution (`module: "commonjs"`)
- Registered in `package.json` under `bin` field
- Can be executed via `npx ingestor` when installed

#### Layer 2: Shell Wrappers (`scripts/`)

**Purpose:** User-friendly interfaces with path resolution and auto-detection

```bash
# scripts/xrd-transform.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Delegate to bin script
"${PLUGIN_DIR}/bin/ingestor" "${ARGS[@]}"
```

**Key aspects:**
- Handle relative path conversion to absolute paths
- Auto-detect kubectl context for cluster targeting
- Provide helpful defaults and validation
- Delegate execution to bin scripts

#### Why This Architecture?

1. **npm Compatibility**: Bin scripts work when plugin is installed as a package
2. **Development Convenience**: Shell wrappers provide better UX for local development
3. **Consistent Execution**: Both layers use the same TypeScript CLI implementation
4. **Module Resolution**: tsconfig.cli.json ensures CommonJS mode for reliable imports

#### TypeScript Config for CLI

`tsconfig.cli.json` is crucial for bin scripts to work:

```json
{
  "compilerOptions": {
    "module": "commonjs",  // Critical: Forces CommonJS module resolution
    "target": "ES2020",
    "esModuleInterop": true,
    // ... other options
  }
}
```

Without this, ts-node would use ESM mode by default, causing module resolution errors.

## XRD Transform Script

### Location

`./scripts/xrd-transform.sh` - Shell script wrapper that delegates to `bin/ingestor`

### Purpose

Transforms Crossplane XRDs into Backstage template entities using:
- Handlebars templates from `./templates/`
- Plugin configuration from `app-config.yaml`
- XRD annotations for customization

### Usage

```bash
# Basic usage
./scripts/xrd-transform.sh path/to/xrd.yaml

# With options
./scripts/xrd-transform.sh [options] <xrd-file>

Options:
  -t <template>   Template to use (default: default)
  -o <output>     Output directory
  -v              Validate mode (no output)
  --help          Show help
```

### Examples

```bash
# Transform basic XRD
./scripts/xrd-transform.sh ../../../template-namespace/configuration/xrd.yaml

# Generate template for GitOps workflow
./scripts/xrd-transform.sh \
  -t gitops \
  tests/xrd-transform/fixtures/04-gitops-workflow.yaml

# Validate XRD compatibility
./scripts/xrd-transform.sh -v path/to/xrd.yaml
```

### Output

The script generates **two entities**:
1. **Template entity** - For the Backstage Software Catalog
2. **API entity** - Documentation for the XRD

Both are output as a single multi-document YAML file (separated by `---`).

### Workspace Integration

The workspace root includes a wrapper script at `portal-workspace/scripts/xrd-transform.sh` that delegates to this plugin's script. This allows running the transform from anywhere in the workspace:

```bash
# From workspace root
./scripts/xrd-transform.sh template-namespace/configuration/xrd.yaml

# From template directory
cd template-namespace
../scripts/xrd-transform.sh configuration/xrd.yaml
```

## Template System

### Template Files

Located in `./templates/`:

- **`default.hbs`** - Main template for both namespaced and cluster-scoped resources
- **`gitops.hbs`** - Step template for PR-based GitOps workflow
- **`parameters.hbs`** - Shared parameter definitions (used by templates)

### Template Selection

Templates are selected via XRD annotations:

```yaml
metadata:
  annotations:
    openportal.dev/template-steps: "gitops"      # Use gitops.hbs for steps
    openportal.dev/template-parameters: "gitops" # Use GitOps parameters
```

### Customization

See [templates/README.md](./templates/README.md) for detailed template development guide.

## Configuration

### Plugin Configuration

The ingestor uses modular configuration from `app-config/ingestor.yaml`:

```yaml
kubernetesIngestor:
  components:
    enabled: true
    excludedNamespaces:
      - kube-system
      - kube-public
  crossplane:
    enabled: true
    xrds:
      enabled: true
      gitops:
        ordersRepo:
          owner: 'your-org'
          repo: 'catalog-orders'
          targetBranch: 'main'
```

### GitOps Workflow

The GitOps workflow requires configuration in `app-config.yaml`:

```yaml
kubernetesIngestor:
  crossplane:
    xrds:
      gitops:
        ordersRepo:
          owner: 'open-service-portal'
          repo: 'catalog-orders'
          targetBranch: 'main'
```

This configuration is:
- Required for templates using `openportal.dev/template-steps: "gitops"`
- Validated at template generation time
- Fails fast with helpful error messages if missing

## Documentation

### For Users

- **[Quick Start](./docs/quick-start.md)** - Get started quickly
- **[Configuration Reference](./docs/configuration.md)** - All config options
- **[XRD Annotations Reference](./docs/xrd-annotations-reference.md)** - Control template generation
- **[XRD Transform Examples](./docs/xrd-transform-examples.md)** - Complete usage guide
- **[XR Status Links](./docs/xr-status-links.md)** - Automatic link extraction

### For Developers

- **[Architecture Overview](./docs/architecture.md)** - System design
- **[XRD Ingestion](./docs/xrd-ingestion.md)** - How XRDs become templates
- **[Template Development](./templates/README.md)** - Creating custom templates
- **[CLI Implementation](./docs/cli-implementation.md)** - CLI tools architecture
- **[Testing Guide](./tests/xrd-transform/README.md)** - Running and writing tests

## Common Tasks

### Transform XRD to Template

```bash
./scripts/xrd-transform.sh path/to/xrd.yaml > output.yaml
```

### Test Template Changes

```bash
# 1. Make changes to templates/default.hbs
# 2. Run tests to see impact
./run-tests.sh

# 3. Review differences carefully
# 4. Update expected files if intentional
```

### Debug Template Generation

```bash
# Enable debug mode to see verbose output
./scripts/xrd-transform.sh -t debug path/to/xrd.yaml
```

### Validate XRD Compatibility

```bash
# Check if XRD can be transformed
./scripts/xrd-transform.sh -v path/to/xrd.yaml

# Exit code 0 = valid, non-zero = invalid
```

## Best Practices

### Test-Driven Development

1. **Create fixture** - Add new test XRD in `tests/xrd-transform/fixtures/`
2. **Generate expected** - Run transform and review output
3. **Commit expected** - Check expected output into git
4. **Make changes** - Modify templates or engine
5. **Run tests** - Validate changes with `./run-tests.sh`
6. **Review diffs** - Understand all changes before updating expected files

### Template Development

1. **Start with fixtures** - Use test fixtures for rapid iteration
2. **Use debug mode** - See what variables are available
3. **Test all scenarios** - Namespaced, cluster-scoped, GitOps, etc.
4. **Document annotations** - Update XRD annotations reference
5. **Update tests** - Add regression tests for new features

### Configuration Management

1. **Use modular config** - Keep configuration in `app-config/ingestor.yaml`
2. **Validate early** - Fail fast with helpful error messages
3. **Document requirements** - Update configuration reference
4. **Test with real clusters** - Verify kubectl context auto-detection

## Troubleshooting

### Tests Failing

```bash
# See what changed
./run-tests.sh

# Review specific test output
cat tests/xrd-transform/output/01-basic-namespaced.yaml

# Compare with expected
diff -u \
  tests/xrd-transform/expected/01-basic-namespaced.yaml \
  tests/xrd-transform/output/01-basic-namespaced.yaml
```

### Transform Script Not Found

```bash
# Verify script exists
ls -la ./scripts/xrd-transform.sh

# Check permissions
chmod +x ./scripts/xrd-transform.sh
```

### Template Errors

```bash
# Enable debug mode
./scripts/xrd-transform.sh -t debug path/to/xrd.yaml

# Check template syntax
cat templates/default.hbs
```

## Related Documentation

- **[Main README](./README.md)** - Plugin overview and features
- **[K8S RBAC](./K8S_RBAC.md)** - Kubernetes permissions required
- **[Template System](./templates/README.md)** - Handlebars template development
- **[Test Suite](./tests/xrd-transform/README.md)** - Regression testing details

---

**Remember:**
- Run `./run-tests.sh` after any template or engine changes
- Review all test diffs before updating expected files
- Document changes in commit messages
- Keep test fixtures and expected outputs in sync
