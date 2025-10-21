#!/usr/bin/env bash
# Prepare release by updating package.json and CHANGELOG.md
#
# Usage:
#   ./prepare-release.sh <VERSION>
#
# Example:
#   ./prepare-release.sh 1.2.0

set -euo pipefail

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <VERSION>"
  echo "Example: $0 1.2.0"
  exit 1
fi

# Remove 'v' prefix if present
VERSION="${VERSION#v}"

echo "🚀 Preparing release v${VERSION}"

# Update package.json
echo "📦 Updating package.json to version $VERSION"
npm version "$VERSION" --no-git-tag-version

# Update CHANGELOG.md
CHANGELOG="CHANGELOG.md"
DATE=$(date +%Y-%m-%d)

if [ ! -f "$CHANGELOG" ]; then
  echo "⚠️  CHANGELOG.md not found"
  exit 1
fi

echo "📝 Updating CHANGELOG.md"

# Replace "## Unreleased" with "## v$VERSION ($DATE)"
# Add new Unreleased section at the top
if grep -q "## Unreleased" "$CHANGELOG"; then
  # Create temp file
  TMP_FILE=$(mktemp)

  awk -v version="$VERSION" -v date="$DATE" '
    /^## Unreleased/ {
      print "## Unreleased";
      print "";
      print "## v" version " (" date ")";
      next;
    }
    {print}
  ' "$CHANGELOG" > "$TMP_FILE"

  mv "$TMP_FILE" "$CHANGELOG"
  echo "✅ Updated CHANGELOG.md: ## Unreleased -> ## v$VERSION ($DATE)"
else
  echo "⚠️  No '## Unreleased' section found in CHANGELOG.md"
fi

echo "✅ Release preparation complete for v${VERSION}"
