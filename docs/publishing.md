# Publishing Guide

This document describes how to publish the `@open-service-portal/backstage-plugin-ingestor` package to npm.

## Prerequisites

### 1. npm Account Setup

You need an npm account with access to the `@open-service-portal` organization:

```bash
# Login to npm
npm login

# Verify you're logged in
npm whoami
```

### 2. GitHub Repository Setup (Choose One Method)

#### Option A: Trusted Publishing with OIDC (Recommended)

**Benefits:**
- No long-lived tokens to manage
- Automatic provenance attestations
- More secure (no token exposure risk)
- Available since npm CLI 11.5.1

**Setup:**

1. **Configure on npmjs.com:**
   - Go to https://www.npmjs.com/package/@open-service-portal/backstage-plugin-ingestor/access
   - Navigate to "Publishing access" → "Trusted publishers"
   - Click "Add trusted publisher"
   - Configure:
     - **Provider**: GitHub Actions
     - **Organization**: `open-service-portal`
     - **Repository**: `ingestor`
     - **Workflow**: `.github/workflows/publish.yml`
     - **Environment**: (leave blank)

2. **Verify workflow permissions:**
   - The workflow already has `id-token: write` permission ✅
   - No additional GitHub secrets needed ✅

3. **That's it!** The workflow will authenticate using OIDC when publishing.

#### Option B: Token-Based Publishing (Legacy)

**Use this if:**
- You prefer traditional token-based auth
- Need to support older npm CLI versions
- Want a backup authentication method

**Setup:**

1. Generate an npm access token:
   - Go to https://www.npmjs.com/settings/[username]/tokens
   - Click "Generate New Token" → "Automation"
   - Copy the token

2. Add token to GitHub repository:
   - Go to https://github.com/open-service-portal/ingestor/settings/secrets/actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: [paste your token]

## Publishing Process

### Automated Publishing (Recommended)

The package is automatically published when you create a GitHub release:

```bash
# 1. Update version in package.json
cd plugins/ingestor
vim package.json  # Bump version: 1.0.0 → 1.1.0

# 2. Commit version bump
git add package.json
git commit -m "chore: bump version to 1.1.0"
git push origin main

# 3. Create and push git tag
git tag v1.1.0
git push origin v1.1.0

# 4. Create GitHub release (via web UI or CLI)
gh release create v1.1.0 \
  --title "v1.1.0" \
  --notes "Release notes here"
```

The GitHub Actions workflow will automatically:
- Build the package
- Run tests
- Publish to npm with provenance

### Manual Publishing

For emergency releases or testing:

```bash
# 1. Build the package
yarn build

# 2. Test the build
yarn test

# 3. Check what will be published
npm pack --dry-run

# 4. Publish (requires npm login)
npm publish --access public
```

## Version Management

Follow semantic versioning (semver):

- **Patch** (1.0.x): Bug fixes, documentation updates
- **Minor** (1.x.0): New features, backward compatible
- **Major** (x.0.0): Breaking changes

```bash
# Bump version automatically
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.1 → 1.1.0
npm version major  # 1.1.0 → 2.0.0
```

## What Gets Published

The package includes only:
- `dist/` - Compiled JavaScript and TypeScript definitions
- `bin/` - CLI executables
- `templates/` - Handlebars templates (production)
- `package.json` - Package metadata
- `README.md` - Documentation

Excluded (via `.npmignore`):
- Source files (`src/`)
- Tests (`tests/`)
- Documentation (`docs/`)
- Development configs
- Shell scripts (`scripts/`)

## Testing Before Publishing

### 1. Local Pack Test

```bash
# Create a tarball
npm pack

# Inspect the tarball contents
tar -tzf open-service-portal-backstage-plugin-ingestor-1.0.0.tgz

# Install locally in another project
cd /path/to/test-project
npm install /path/to/ingestor/open-service-portal-backstage-plugin-ingestor-1.0.0.tgz
```

### 2. Local Registry Test

Use Verdaccio for local npm registry testing:

```bash
# Install verdaccio
npm install -g verdaccio

# Start local registry
verdaccio

# In another terminal, point npm to local registry
npm set registry http://localhost:4873/

# Publish to local registry
npm publish

# Test installation
cd /path/to/test-project
npm install @open-service-portal/backstage-plugin-ingestor

# Reset npm registry when done
npm set registry https://registry.npmjs.org/
```

## Installation in Backstage Apps

Once published, users can install the package:

```bash
# In a Backstage app
yarn add @open-service-portal/backstage-plugin-ingestor
```

### Backend Integration

```typescript
// packages/backend/src/index.ts
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// Add the ingestor plugin
backend.add(import('@open-service-portal/backstage-plugin-ingestor'));

backend.start();
```

### Configuration

Add to `app-config.yaml`:

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
```

## Troubleshooting

### Build Fails

```bash
# Clean and rebuild
yarn clean
yarn install
yarn build
```

### Permission Denied

Ensure you're logged in to npm and have access to the organization:

```bash
npm login
npm whoami
npm access ls-packages @open-service-portal
```

### Version Already Published

npm doesn't allow republishing the same version:

```bash
# Bump version and try again
npm version patch
git push && git push --tags
```

### GitHub Actions Fails

Check the workflow logs:
1. Go to https://github.com/open-service-portal/ingestor/actions
2. Click on the failed workflow run
3. Review the error messages
4. Common issues:
   - Missing `NPM_TOKEN` secret
   - Build failures
   - Test failures (non-blocking)

## Post-Publishing Checklist

- [ ] Verify package appears on npm: https://www.npmjs.com/package/@open-service-portal/backstage-plugin-ingestor
- [ ] Check package contents are correct (no source files, includes dist)
- [ ] Test installation in a fresh Backstage app
- [ ] Update app-portal to use the published version
- [ ] Update documentation with new version number
- [ ] Announce the release (if significant)

## Rolling Back a Release

If you publish a broken version:

```bash
# Deprecate the broken version (doesn't delete it)
npm deprecate @open-service-portal/backstage-plugin-ingestor@1.0.0 "Broken release, use 1.0.1 instead"

# Publish a fixed version
npm version patch
npm publish
```

## CI/CD Pipeline

The publishing workflow runs:
1. **Checkout** - Fetch the release tag
2. **Setup Node.js** - Install Node.js 20
3. **Install** - Run `yarn install --frozen-lockfile`
4. **Build** - Run `yarn build`
5. **Test** - Run `yarn test` (non-blocking)
6. **Publish** - Run `yarn npm publish` with provenance

Provenance ensures the package is:
- Built from the official repository
- Signed with GitHub's OIDC token
- Verifiable by users

## Support

For issues with publishing:
- Check GitHub Actions logs
- Review npm audit logs: `npm audit`
- Ask in the team chat or create an issue

## References

- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [npm Provenance](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub Actions](https://docs.github.com/en/actions)
