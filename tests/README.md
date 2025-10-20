# Test Structure

Flattened, scenario-based test organization.

## Structure

```
tests/
├── output/                    # Generated output (gitignored)
├── templates/                 # Minimal test templates
│   ├── backstage/
│   ├── parameters/
│   ├── steps/
│   └── output/
├── scope/                     # Scenario: Resource scope
│   ├── test-namespaced.yaml   # Test fixture
│   ├── assert-namespaced.yaml # Expected output
│   ├── test-cluster.yaml
│   └── assert-cluster.yaml
├── multi-templates/           # Scenario: Multi-template composition
│   ├── test-output-blocks.yaml
│   └── assert-output-blocks.yaml
├── helpers/                   # Scenario: Handlebars helpers
├── conditionals/              # Scenario: Conditional logic
...
```

## Naming Convention

- **Test fixtures**: `test-<case-name>.yaml` - Input XRD
- **Assertions**: `assert-<case-name>.yaml` - Expected output
- **Generated**: `output/<scenario>-<case-name>.yaml` - Actual output

The test runner matches `test-*.yaml` with `assert-*.yaml` by name.

## Scenarios

Each scenario directory contains related test cases:

| Scenario | Purpose | Test Count | Focus |
|----------|---------|------------|-------|
| `scope` | Namespaced vs Cluster resources | 2 | Transform engine scope detection |
| `multi-templates` | Comma-separated template composition | 1 | YAML merge with multiple templates |
| `yaml-merge` | YAML merge edge cases | 1 | Three-way merge, nested objects |
| `annotations` | XRD annotation handling | 3 | Tags, description, owner annotations |
| `helpers` | Handlebars helper functions | 3 | Slugify, replace, conditionals |
| `properties` | Property extraction & types | 3 | String, integer, boolean, array, enum, required |
| `e2e` | End-to-end with production templates | 2 | Namespace, Whoami real-world validation |

**Total**: 7 scenarios, 15 tests, all passing ✅

## Running Tests

```bash
# All tests
./run-tests.sh

# Watch mode (if implemented)
./run-tests.sh --watch

# Specific scenario
find tests/scope -name "test-*.yaml" -exec ./scripts/xrd-transform.sh --template-path tests/templates {} \;
```

## Test Templates

Test templates in `tests/templates/` are **minimal** - designed to test transform logic, not create valid Backstage templates.

- Simple one-liners where possible
- Obvious test values (`test-action`, `test-url`)
- No complex logic unless testing that feature

## Production Templates

E2E tests in `tests/e2e/` use production templates from `templates/` to ensure real-world scenarios work.

## Assertion File Headers

All `assert-*.yaml` files include **protective headers** that prevent accidental corruption:

```yaml
# TEST ASSERTION - DO NOT BLINDLY REGENERATE
#
# Test: namespaced
# Purpose: Validates that Namespaced scope XRDs include namespace parameter
# Scenario: scope
#
# This file contains the EXPECTED output for this test case.
# It should only be updated when:
#   1. Adding NEW features that intentionally change output
#   2. Fixing BUGS where the old output was incorrect
#   3. Modifying templates with a clear, documented purpose
#
# NEVER blindly regenerate this file without understanding WHY the output changed!
#
# To update after reviewing changes:
#   cp tests/output/scope-namespaced.yaml tests/scope/assert-namespaced.yaml
#
# This header will be stripped during test comparison.
# ---

apiVersion: scaffolder.backstage.io/v1beta3
...
```

**Key points:**
- Headers are **automatically stripped** during test comparison
- Document test **purpose** and **scenario** for maintainability
- **Manual edits are acceptable** - headers protect intent, not immutability
- **Intentional updates** should follow the documented procedure

### When to Update Assertions

✅ **DO update** when:
- Adding new features that change output
- Fixing bugs where old output was incorrect
- Refactoring templates with clear purpose
- Improving error messages or validation

❌ **DO NOT update** when:
- Tests fail unexpectedly
- You don't understand why output changed
- Blindly running `cp` without reviewing diffs

### Adding Headers to New Assertions

Use the automated script to add headers to new assertion files:

```bash
# Add headers to all assert files
./scripts/add-test-headers.sh

# Or manually add header following the format above
```

## Adding Tests

1. **Choose scenario** - Or create new directory
2. **Create fixture**: `tests/scenario/test-mycase.yaml`
3. **Run tests**: `./run-tests.sh`
4. **Review output**: `tests/output/scenario-mycase.yaml`
5. **Accept as assertion**: `cp tests/output/scenario-mycase.yaml tests/scenario/assert-mycase.yaml`
6. **Add protective header**: `./scripts/add-test-headers.sh`
7. **Verify**: `./run-tests.sh` should pass

## Test Development Workflow

```bash
# 1. Create test fixture
cat > tests/scope/test-newcase.yaml <<EOF
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
...
EOF

# 2. Generate output
./run-tests.sh  # Will show "No assertion (new test)"

# 3. Review output
cat tests/output/scope-newcase.yaml

# 4. Accept if correct
cp tests/output/scope-newcase.yaml tests/scope/assert-newcase.yaml

# 5. Add protective header
./scripts/add-test-headers.sh

# 6. Verify test passes
./run-tests.sh
```

### Updating Existing Assertions

When test output changes intentionally (feature addition, bug fix, template refactoring):

```bash
# 1. Run tests to see what changed
./run-tests.sh

# 2. Review the diff carefully
diff -u \
  <(sed '1,/^# ---$/d' tests/scope/assert-namespaced.yaml | sed '1{/^$/d;}') \
  tests/output/scope-namespaced.yaml

# 3. Understand WHY the output changed
#    - Is this expected?
#    - Does it align with your changes?
#    - Are there unintended side effects?

# 4. If change is intentional, update assertion
cp tests/output/scope-namespaced.yaml tests/scope/assert-namespaced.yaml

# 5. Update the header's purpose if test focus changed
vim tests/scope/assert-namespaced.yaml  # Edit purpose line if needed

# 6. Verify test passes
./run-tests.sh
```

## Principles

1. **Flat structure** - No nested fixtures/expected directories
2. **Scenario grouping** - Related tests in same directory
3. **Naming convention** - `test-*` and `assert-*` prefix for matching
4. **Shared output** - All generated files in `tests/output/`
5. **Minimal templates** - Test templates focus on transform logic
6. **Production E2E** - E2E tests use real production templates

## Benefits

- **Easy to navigate** - Flat structure, clear naming
- **Fast tests** - Minimal templates, focused scenarios
- **Stable** - Test templates rarely change
- **Comprehensive** - 25+ scenarios planned
- **Maintainable** - Simple structure, obvious relationships
