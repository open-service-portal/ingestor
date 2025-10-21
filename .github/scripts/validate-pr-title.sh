#!/usr/bin/env bash
# Validate PR title follows conventional commits format
#
# Usage:
#   ./validate-pr-title.sh <PR_TITLE>
#
# Example:
#   ./validate-pr-title.sh "feat: add new feature"
#
# Exit codes:
#   0 - Valid
#   1 - Invalid

set -euo pipefail

PR_TITLE="${1:-}"

if [ -z "$PR_TITLE" ]; then
  echo "Usage: $0 <PR_TITLE>"
  echo "Example: $0 'feat: add new feature'"
  exit 1
fi

# Conventional commit types
TYPES="feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert"

# Regex pattern for conventional commits
# Format: type(optional-scope): description
# Examples:
#   feat: add new feature
#   fix(api): resolve issue
#   feat!: breaking change
PATTERN="^($TYPES)(\(.+\))?!?: .+"

if [[ "$PR_TITLE" =~ $PATTERN ]]; then
  echo "✅ Valid: $PR_TITLE"
  exit 0
else
  echo "❌ Invalid PR title format"
  echo ""
  echo "PR title must follow conventional commits:"
  echo "  <type>(<optional-scope>): <description>"
  echo ""
  echo "Valid types: ${TYPES//|/, }"
  echo ""
  echo "Examples:"
  echo "  feat: add user authentication"
  echo "  fix: resolve login bug"
  echo "  docs: update README"
  echo "  chore(deps): update dependencies"
  echo "  feat!: breaking API change"
  echo ""
  echo "Your title: $PR_TITLE"
  exit 1
fi
