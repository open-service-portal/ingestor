# Release Automation Scripts

These scripts power the automated release workflows and can be run locally for testing.

## Scripts

### `validate-pr-title.sh`

Validates that a PR title follows conventional commits format.

**Usage:**
```bash
./validate-pr-title.sh "feat: add new feature"
```

**Exit codes:**
- `0` - Valid title
- `1` - Invalid title

**Examples:**
```bash
# Valid titles
./validate-pr-title.sh "feat: add user authentication"
./validate-pr-title.sh "fix: resolve login bug"
./validate-pr-title.sh "docs: update README"
./validate-pr-title.sh "chore(deps): update dependencies"
./validate-pr-title.sh "feat!: breaking API change"

# Invalid titles
./validate-pr-title.sh "add feature"  # Missing type
./validate-pr-title.sh "FEAT: test"   # Wrong case
```

### `prepare-release.sh`

Prepares a release by updating package.json and CHANGELOG.md.

**Usage:**
```bash
./prepare-release.sh <VERSION>
```

**Examples:**
```bash
./prepare-release.sh 1.2.0
./prepare-release.sh v1.2.0  # 'v' prefix is automatically stripped
```

**What it does:**
1. Updates `package.json` version using `npm version`
2. Replaces `## Unreleased` with `## v1.2.0 (2025-10-21)` in CHANGELOG.md
3. Adds new `## Unreleased` section at the top

## Testing Locally

All scripts can be tested locally before pushing to CI:

```bash
# Test PR title validation
./.github/scripts/validate-pr-title.sh "feat: my feature"

# Test release preparation
./.github/scripts/prepare-release.sh 1.2.0
git diff package.json CHANGELOG.md
git checkout package.json CHANGELOG.md  # Reset after testing
```

## Workflow Integration

These scripts are used by GitHub Actions workflows:

- **`.github/workflows/pr-title-lint.yml`** - Uses `validate-pr-title.sh`
- **`.github/workflows/release.yml`** - Uses `prepare-release.sh`

## Release Workflow

### Simple, Sequential Process

When you create a tag, the workflow executes these steps **in order**:

1. **Extract version** from tag (e.g., `v1.2.0` → `1.2.0`)
2. **Create release branch** (`release/v1.2.0`)
3. **Update version** in package.json and CHANGELOG.md
4. **Commit and push** changes
5. **Create Pull Request** for review
6. **Wait for PR merge** (up to 10 minutes)
7. **Create GitHub Release** (only if PR merged)
8. **Trigger npm publish** (automatic via existing workflow)

### No Parallel Steps

Everything happens sequentially, making it easy to understand and debug.

### Manual CHANGELOG Updates

**Developers update CHANGELOG.md manually in their PRs:**

```markdown
## Unreleased

### Features
- Add user authentication (#123)
- Add dark mode (#124)

### Bug Fixes
- Fix login timeout (#125)
```

When ready to release, just create a tag:
```bash
git tag v1.2.0
git push origin v1.2.0
```

The release workflow moves `## Unreleased` to `## v1.2.0 (date)`.

## Conventional Commits

PR titles should follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

**Format:**
```
<type>(<optional-scope>): <description>
```

**Types:**
- `feat` → New feature (minor version bump)
- `fix` → Bug fix (patch version bump)
- `docs` → Documentation changes
- `style` → Code formatting
- `refactor` → Code refactoring
- `perf` → Performance improvements
- `test` → Adding tests
- `build` → Build system changes
- `ci` → CI/CD changes
- `chore` → Maintenance tasks
- `revert` → Revert previous commit

**Breaking changes:**
Add `!` after type or `BREAKING CHANGE:` in commit body → Major version bump

**Examples:**
- `feat: add user authentication` → Suggests v1.1.0
- `fix: resolve login bug` → Suggests v1.0.1
- `feat!: redesign API` → Suggests v2.0.0

**Note:** Version bumps are manual - you choose the version when creating the tag.
