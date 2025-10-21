#!/usr/bin/env bash
# Update CHANGELOG.md with PR entry
#
# Usage:
#   ./update-changelog.sh <PR_NUMBER> <PR_TITLE>
#
# Example:
#   ./update-changelog.sh 123 "feat: add new feature"

set -euo pipefail

PR_NUMBER="${1:-}"
PR_TITLE="${2:-}"

if [ -z "$PR_NUMBER" ] || [ -z "$PR_TITLE" ]; then
  echo "Usage: $0 <PR_NUMBER> <PR_TITLE>"
  echo "Example: $0 123 'feat: add new feature'"
  exit 1
fi

CHANGELOG="CHANGELOG.md"

echo "📝 Updating changelog for PR #$PR_NUMBER: $PR_TITLE"

# Parse conventional commit type from PR title
SECTION="### Other Changes"
DESCRIPTION="$PR_TITLE"

if [[ "$PR_TITLE" =~ ^feat(\(.+\))?!?:[[:space:]](.+) ]]; then
  SECTION="### Features"
  DESCRIPTION="${BASH_REMATCH[2]}"
elif [[ "$PR_TITLE" =~ ^fix(\(.+\))?!?:[[:space:]](.+) ]]; then
  SECTION="### Bug Fixes"
  DESCRIPTION="${BASH_REMATCH[2]}"
elif [[ "$PR_TITLE" =~ ^docs(\(.+\))?:[[:space:]](.+) ]]; then
  SECTION="### Documentation"
  DESCRIPTION="${BASH_REMATCH[2]}"
elif [[ "$PR_TITLE" =~ ^perf(\(.+\))?:[[:space:]](.+) ]]; then
  SECTION="### Performance"
  DESCRIPTION="${BASH_REMATCH[2]}"
elif [[ "$PR_TITLE" =~ ^refactor(\(.+\))?:[[:space:]](.+) ]]; then
  SECTION="### Refactoring"
  DESCRIPTION="${BASH_REMATCH[2]}"
elif [[ "$PR_TITLE" =~ ^test(\(.+\))?:[[:space:]](.+) ]]; then
  SECTION="### Tests"
  DESCRIPTION="${BASH_REMATCH[2]}"
elif [[ "$PR_TITLE" =~ ^build(\(.+\))?:[[:space:]](.+) ]]; then
  SECTION="### Build System"
  DESCRIPTION="${BASH_REMATCH[2]}"
elif [[ "$PR_TITLE" =~ ^ci(\(.+\))?:[[:space:]](.+) ]]; then
  SECTION="### CI/CD"
  DESCRIPTION="${BASH_REMATCH[2]}"
elif [[ "$PR_TITLE" =~ ^chore(\(.+\))?:[[:space:]](.+) ]]; then
  SECTION="### Chores"
  DESCRIPTION="${BASH_REMATCH[2]}"
fi

echo "  Section: $SECTION"
echo "  Description: $DESCRIPTION"

# Check if PR is already in changelog
if [ -f "$CHANGELOG" ] && grep -q "#$PR_NUMBER" "$CHANGELOG"; then
  echo "ℹ️  PR #$PR_NUMBER already in CHANGELOG.md"
  exit 0
fi

# Create CHANGELOG.md if it doesn't exist
if [ ! -f "$CHANGELOG" ]; then
  echo "📄 Creating new CHANGELOG.md"
  cat > "$CHANGELOG" <<EOF
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

EOF
fi

# Ensure Unreleased section exists
if ! grep -q "## Unreleased" "$CHANGELOG"; then
  echo "➕ Adding Unreleased section"
  # Add after first heading using awk (cross-platform)
  awk '/^# / && !added {print; print "\n## Unreleased\n"; added=1; next} {print}' "$CHANGELOG" > "$CHANGELOG.tmp"
  mv "$CHANGELOG.tmp" "$CHANGELOG"
fi

# Check if section exists under Unreleased
SECTION_EXISTS=$(awk '/^## Unreleased/,/^## / {if (/^'"$SECTION"'$/) print "yes"}' "$CHANGELOG")

if [ "$SECTION_EXISTS" != "yes" ]; then
  echo "➕ Adding section: $SECTION"
  # Add section after ## Unreleased using awk
  awk '/^## Unreleased/ {print; print ""; print "'"$SECTION"'"; next} {print}' "$CHANGELOG" > "$CHANGELOG.tmp"
  mv "$CHANGELOG.tmp" "$CHANGELOG"
fi

# Add the entry
ENTRY="- ${DESCRIPTION} (#${PR_NUMBER})"
echo "✅ Adding: $ENTRY"

# Create temp file
TMP_FILE=$(mktemp)

# Add entry under the section
awk -v section="$SECTION" -v entry="$ENTRY" '
  {
    print;
    if ($0 ~ "^" section "$") {
      # Print the new entry on the next line
      print entry;
      # Skip to next line
      if (getline > 0) {
        # If next line is not empty and not another entry, print it
        if ($0 !~ /^-/ && $0 !~ /^$/ && $0 !~ /^###/) {
          print;
        } else if ($0 ~ /^-/) {
          # If its another entry, print our entry was already added above
          print;
        } else if ($0 ~ /^###/ || $0 ~ /^##/) {
          # If its another section, print it
          print;
        }
      }
    }
  }
' "$CHANGELOG" > "$TMP_FILE"

mv "$TMP_FILE" "$CHANGELOG"

echo "✅ Changelog updated successfully"
