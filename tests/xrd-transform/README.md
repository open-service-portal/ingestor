# XRD Transform Test Suite

This directory contains a diff-based test suite for validating XRD transformations. Tests compare actual output against expected YAML files, serving as both validation and living documentation.

## Directory Structure

```
tests/xrd-transform/
├── fixtures/           # Test XRD input files
│   ├── 01-basic-namespaced.yaml
│   ├── 02-parameter-annotations.yaml
│   ├── 03-cluster-scoped.yaml
│   ├── 04-gitops-workflow.yaml
│   └── 05-complex-properties.yaml
├── expected/           # Expected transform outputs (checked into git)
│   ├── 01-basic-namespaced.yaml
│   ├── 02-parameter-annotations.yaml
│   ├── 03-cluster-scoped.yaml
│   ├── 04-gitops-workflow.yaml
│   └── 05-complex-properties.yaml
├── output/             # Actual test outputs (gitignored)
├── run-tests.sh        # Diff-based test runner
└── README.md           # This file
```

## Test Cases

### Test 01: Basic Namespaced XRD
**Fixture:** `01-basic-namespaced.yaml`

Tests the most basic transformation:
- Namespaced resource (includes `namespace` parameter)
- Default workflow (direct `kube:apply`)
- Simple enum properties

### Test 02: Parameter Annotations
**Fixture:** `02-parameter-annotations.yaml`

Tests `openportal.dev/parameter.*` annotations:
- GitOps PR workflow
- Parameter defaults override global config
- XRD-level configuration

**Key Annotations:**
```yaml
openportal.dev/template-steps: "gitops"
openportal.dev/template-parameters: "gitops"
openportal.dev/parameter.gitopsOwner: "database-team"
openportal.dev/parameter.gitopsRepo: "database-orders"
```

### Test 03: Cluster-Scoped XRD
**Fixture:** `03-cluster-scoped.yaml`

Tests cluster-scoped resources:
- `scope: Cluster` in XRD spec
- No namespace parameter in form
- Integer properties with constraints

### Test 04: GitOps Workflow
**Fixture:** `04-gitops-workflow.yaml`

Tests GitOps workflow with documentation:
- GitOps PR workflow
- TechDocs annotation passthrough
- User-configurable GitOps parameters

### Test 05: Complex Properties
**Fixture:** `05-complex-properties.yaml`

Tests complex OpenAPI types:
- Boolean properties
- Object properties with `additionalProperties`
- Array properties with item schemas

## Running Tests

### Run All Tests

```bash
cd plugins/ingestor/tests/xrd-transform
./run-tests.sh
```

### Expected Output

```
═══════════════════════════════════════════════════════════
  XRD Transform Test Suite - Diff-Based Testing
═══════════════════════════════════════════════════════════

Test: 01-basic-namespaced
  ✓ Output matches expected

Test: 02-parameter-annotations
  ✓ Output matches expected

...

═══════════════════════════════════════════════════════════
  Test Summary
═══════════════════════════════════════════════════════════
Total tests:  5
Passed:       5
Failed:       0
```

## How It Works

1. **Transform Generation**: Each fixture XRD is transformed using `scripts/xrd-transform.sh`
2. **Diff Comparison**: Output is compared against expected YAML using `diff -u`
3. **Pass/Fail**: Tests pass if output exactly matches expected output

## Adding New Tests

### 1. Create Test Fixture

```bash
# Create new XRD in fixtures/
cat > fixtures/06-my-test.yaml <<EOF
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: myresources.example.com
  annotations:
    openportal.dev/parameter.customValue: "test"
spec:
  # ... XRD spec
EOF
```

### 2. Generate Expected Output

```bash
# From workspace root
./scripts/xrd-transform.sh \
  app-portal/plugins/ingestor/tests/xrd-transform/fixtures/06-my-test.yaml \
  > app-portal/plugins/ingestor/tests/xrd-transform/expected/06-my-test.yaml
```

### 3. Review Expected Output

```bash
# Verify the generated template looks correct
cat expected/06-my-test.yaml | less
```

### 4. Run Tests

```bash
./run-tests.sh
```

## Updating Expected Outputs

When you intentionally change transform behavior:

```bash
# Regenerate all expected outputs
for fixture in fixtures/*.yaml; do
  name=$(basename "$fixture" .yaml)
  ../../../../scripts/xrd-transform.sh "$fixture" > "expected/${name}.yaml"
done

# Or update individual test
./../../../../scripts/xrd-transform.sh fixtures/01-basic-namespaced.yaml \
  > expected/01-basic-namespaced.yaml
```

## Viewing Expected Outputs

Expected outputs are checked into git and serve as:

1. **Test Validation** - What the transform should produce
2. **Living Documentation** - Examples of generated templates
3. **Reference Implementation** - What real Backstage templates look like

**Example**: View what a basic namespaced template generates:
```bash
cat expected/01-basic-namespaced.yaml
```

## Troubleshooting

### Test Fails with Diff

When a test fails, you'll see:

```
Test: 02-parameter-annotations
  ✗ Output differs from expected

  Differences:
  --- expected/02-parameter-annotations.yaml
  +++ output/02-parameter-annotations.yaml
  @@ -10,7 +10,7 @@
  -      gitopsOwner: database-team
  +      gitopsOwner: platform-team

  Expected: expected/02-parameter-annotations.yaml
  Actual:   output/02-parameter-annotations.yaml
  To update expected output: cp output/02-parameter-annotations.yaml expected/02-parameter-annotations.yaml
```

**To fix:**
1. Review the diff to understand the change
2. If change is intentional: `cp output/02-parameter-annotations.yaml expected/02-parameter-annotations.yaml`
3. If change is a bug: Fix the transform logic

### Transform Fails

If the transform itself fails:

```
Test: 02-parameter-annotations
  ✗ Transform failed
  Output:
  [ERROR] Failed to render template...
```

**To debug:**
```bash
# Run transform manually to see full error
./../../../../scripts/xrd-transform.sh fixtures/02-parameter-annotations.yaml
```

### Expected Output Missing

```
Test: 06-my-test
  ✗ Expected output not found: expected/06-my-test.yaml
  Run: ./scripts/xrd-transform.sh fixtures/06-my-test.yaml > expected/06-my-test.yaml
```

Follow the suggestion to generate the expected output.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test XRD Transform

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: app-portal/plugins/ingestor
        run: yarn install

      - name: Run XRD Transform Tests
        working-directory: app-portal/plugins/ingestor/tests/xrd-transform
        run: ./run-tests.sh
```

## Test Coverage

Current coverage includes:

- ✅ Namespaced resources
- ✅ Cluster-scoped resources
- ✅ Parameter annotations (`openportal.dev/parameter.*`)
- ✅ GitOps PR workflow
- ✅ Default workflow (kube:apply)
- ✅ TechDocs annotation passthrough
- ✅ GitOps parameter overrides
- ✅ Complex property types (arrays, objects, booleans)
- ✅ Configuration hierarchy (3 levels)
- ✅ Template selection via annotations

## Related Documentation

- [XRD Transform CLI Documentation](../../docs/xrd-transform-cli.md)
- [Template System Documentation](../../templates/README.md)
- [Parameter Annotation Pattern](../../../CLAUDE.md)

---

**Why Diff-Based Testing?**

Traditional JSON validation tests required maintaining complex validation rules. Diff-based testing:
1. **Shows exact expected output** - No guessing what "should" be generated
2. **Serves as documentation** - Expected files are examples
3. **Easier to maintain** - Just regenerate when behavior changes
4. **Clearer failures** - Diff shows exactly what changed
