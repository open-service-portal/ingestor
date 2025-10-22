#!/usr/bin/env bash
#
# Backstage Export - Export templates and entities from Backstage catalog
#
# This script exports entities from a running Backstage instance using the
# backstage-export CLI tool.
#
# Usage:
#   ./scripts/backstage-export.sh [options]
#
# Examples:
#   # Export all templates
#   ./scripts/backstage-export.sh --kind Template
#
#   # Export with filters
#   ./scripts/backstage-export.sh --kind Template --tags crossplane
#
#   # Preview what would be exported
#   ./scripts/backstage-export.sh --preview --kind Template,API
#
#   # List entities only
#   ./scripts/backstage-export.sh --list --kind API
#
# For full documentation, see:
#   docs/cli-export.md
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Save the user's current working directory
USER_CWD="$(pwd)"

# Get the directory where this script is located (plugin scripts directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Default values
DEFAULT_URL="http://localhost:7007"
DEFAULT_OUTPUT="exported"

# Parse arguments to check for help or to set defaults
ARGS=()
HAS_URL=false
HAS_OUTPUT=false
HAS_TOKEN=false
PREV_ARG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            cat <<'EOF'
Backstage Export Tool

Usage: backstage-export.sh [options]

Options:
  -o, --output <dir>     Output directory (default: exported)
  -k, --kind <kinds>     Entity kinds (comma-separated)
  -u, --url <url>        Backstage URL (default: http://localhost:7007)
  -t, --token <token>    API token for authentication
  --namespace <ns>       Namespace filter
  --name <pattern>       Name pattern (supports wildcards)
  --owner <owner>        Owner filter
  --tags <tags>          Tags filter (comma-separated)
  --organize             Organize output by entity type
  --manifest             Generate export manifest file
  -p, --preview          Preview what would be exported
  -l, --list             List matching entities only
  -f, --format <format>  Output format (yaml|json, default: yaml)
  -h, --help             Show this help message

Examples:
  # Export all templates
  backstage-export.sh --kind Template

  # Export with filters and organization
  backstage-export.sh --kind Template --tags crossplane --organize

  # Preview export
  backstage-export.sh --preview --kind Template,API

  # List all APIs
  backstage-export.sh --list --kind API

  # Export from remote Backstage with token
  backstage-export.sh --url https://backstage.example.com --token $TOKEN

Environment Variables:
  BACKSTAGE_TOKEN  API token for authentication

For more information, see:
  docs/cli-export.md
EOF
            exit 0
            ;;
        -u|--url)
            HAS_URL=true
            ;;
        -o|--output)
            HAS_OUTPUT=true
            ;;
        -t|--token)
            HAS_TOKEN=true
            ;;
    esac

    # Convert output path to absolute if it follows -o or --output
    if [[ "$PREV_ARG" == "-o" ]] || [[ "$PREV_ARG" == "--output" ]]; then
        # This is an output path argument, make it absolute if relative
        if [[ ! "$1" =~ ^/ ]]; then
            ARGS+=("${USER_CWD}/$1")
        else
            ARGS+=("$1")
        fi
    else
        ARGS+=("$1")
    fi

    PREV_ARG="$1"
    shift
done

# Add defaults if not provided
if ! $HAS_URL; then
    ARGS=("--url" "$DEFAULT_URL" "${ARGS[@]}")
fi

if ! $HAS_OUTPUT; then
    # Use absolute path for default output
    ARGS=("--output" "${USER_CWD}/$DEFAULT_OUTPUT" "${ARGS[@]}")
fi

if ! $HAS_TOKEN && [ -n "${BACKSTAGE_TOKEN:-}" ]; then
    ARGS=("--token" "$BACKSTAGE_TOKEN" "${ARGS[@]}")
fi

# Run the export CLI
# Prefer compiled version (faster, avoids ts-node issues)
cd "$PLUGIN_DIR"
DIST_CLI="${PLUGIN_DIR}/dist/backstage-export/cli/backstage-export-cli.js"
if [ -f "$DIST_CLI" ]; then
    node "$DIST_CLI" "${ARGS[@]}"
else
    # Fall back to bin script (which may use ts-node)
    "${PLUGIN_DIR}/bin/backstage-export" "${ARGS[@]}"
fi
