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

### `update-changelog.sh`

Updates CHANGELOG.md with a new PR entry under the appropriate section.

**Usage:**
```bash
./update-changelog.sh <PR_NUMBER> <PR_TITLE>
```

**Examples:**
```bash
./update-changelog.sh 123 "feat: add new feature"
./update-changelog.sh 124 "fix: resolve bug"
./update-changelog.sh 125 "docs: update README"
```

**How it works:**
1. Parses the PR title to determine the section (Features, Bug Fixes, etc.)
2. Checks if PR is already in changelog (idempotent)
3. Creates `## Unreleased` section if needed
4. Adds section header if needed (e.g., `### Features`)
5. Adds entry: `- <description> (#<PR_NUMBER>)`

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

# Test changelog update
./.github/scripts/update-changelog.sh 999 "feat: test feature"
git diff CHANGELOG.md
git checkout CHANGELOG.md  # Reset after testing

# Test release preparation
./.github/scripts/prepare-release.sh 1.2.0
git diff package.json CHANGELOG.md
git checkout package.json CHANGELOG.md  # Reset after testing
```

## Workflow Integration

These scripts are used by GitHub Actions workflows:

- **`.github/workflows/pr-title-lint.yml`** - Uses `validate-pr-title.sh`
- **`.github/workflows/changelog.yml`** - Uses `update-changelog.sh`
- **`.github/workflows/release.yml`** - Uses `prepare-release.sh`

## Conventional Commits

All scripts follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

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
- `feat: add user authentication` → v1.1.0
- `fix: resolve login bug` → v1.0.1
- `feat!: redesign API` → v2.0.0
