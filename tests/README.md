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

| Scenario | Purpose | Test Count |
|----------|---------|------------|
| `scope` | Namespaced vs Cluster resources | 2 |
| `multi-templates` | Comma-separated template composition | 1+ |
| `helpers` | Handlebars helper functions | TBD |
| `conditionals` | If/else logic in templates | TBD |
| `parameters` | Parameter template variations | TBD |
| `steps` | Step template variations | TBD |
| `output` | Output template variations | TBD |
| `gitops` | GitOps workflow tests | TBD |
| `annotations` | XRD annotation handling | TBD |
| `metadata` | Metadata extraction | TBD |
| `variables` | Variable substitution | TBD |
| `building-blocks` | Template building blocks | TBD |
| `edge-cases` | Error handling, edge cases | TBD |
| `e2e` | End-to-end with production templates | 2 |

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

## Adding Tests

1. **Choose scenario** - Or create new directory
2. **Create fixture**: `tests/scenario/test-mycase.yaml`
3. **Run tests**: `./run-tests.sh`
4. **Review output**: `tests/output/scenario-mycase.yaml`
5. **Accept as assertion**: `cp tests/output/scenario-mycase.yaml tests/scenario/assert-mycase.yaml`
6. **Verify**: `./run-tests.sh` should pass

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

# 5. Verify test passes
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
