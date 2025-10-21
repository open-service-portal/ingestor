# Release Automation Script

This script powers the automated release workflow and can be tested locally.

## Script

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

The script can be tested locally before pushing to CI:

```bash
# Test release preparation
./.github/scripts/prepare-release.sh 1.2.0
git diff package.json CHANGELOG.md
git checkout package.json CHANGELOG.md  # Reset after testing
```

## Workflow Integration

This script is used by the GitHub Actions release workflow:

- **`.github/workflows/release.yml`** - Uses `prepare-release.sh`

## Release Workflow

###Simple, Sequential Process

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

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **Major** (v2.0.0) - Breaking changes
- **Minor** (v1.2.0) - New features, backward compatible
- **Patch** (v1.1.1) - Bug fixes, backward compatible

You choose the version when creating the tag:
```bash
git tag v1.2.0  # You decide!
git push origin v1.2.0
```
