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

# Get the directory where this script is located (plugin scripts directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Auto-detect API token from Backstage config if not provided
if [ -z "${BACKSTAGE_TOKEN:-}" ]; then
    # Try to find token from local config files
    WORKSPACE_DIR="$(cd "${PLUGIN_DIR}/../../.." && pwd)"
    for config in "$WORKSPACE_DIR"/app-config.*.local.yaml; do
        if [ -f "$config" ]; then
            TOKEN=$(grep -A3 "type: static" "$config" 2>/dev/null | grep "token:" | awk -F': ' '{print $2}' | head -1)
            if [ -n "$TOKEN" ]; then
                export BACKSTAGE_TOKEN="$TOKEN"
                echo -e "${GREEN}✓ Auto-detected API token from $(basename "$config")${NC}" >&2
                break
            fi
        fi
    done

    if [ -z "${BACKSTAGE_TOKEN:-}" ]; then
        echo -e "${YELLOW}Warning: No API token found. Set BACKSTAGE_TOKEN or use --token flag${NC}" >&2
    fi
fi

# Default values
DEFAULT_URL="http://localhost:7007"
DEFAULT_OUTPUT="exported"

# Parse arguments to check for help or to set defaults
ARGS=()
HAS_URL=false
HAS_OUTPUT=false
HAS_TOKEN=false

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
  -t, --token <token>    API token (or auto-detected from config)
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

  # Export from remote Backstage
  backstage-export.sh --url https://backstage.example.com --token $TOKEN

Environment Variables:
  BACKSTAGE_TOKEN  API token for authentication (auto-detected if not set)

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
    ARGS+=("$1")
    shift
done

# Add defaults if not provided
if ! $HAS_URL; then
    ARGS=("--url" "$DEFAULT_URL" "${ARGS[@]}")
fi

if ! $HAS_OUTPUT; then
    ARGS=("--output" "$DEFAULT_OUTPUT" "${ARGS[@]}")
fi

if ! $HAS_TOKEN && [ -n "${BACKSTAGE_TOKEN:-}" ]; then
    ARGS=("--token" "$BACKSTAGE_TOKEN" "${ARGS[@]}")
fi

# Run the export CLI via bin script
cd "$PLUGIN_DIR"
"${PLUGIN_DIR}/bin/backstage-export" "${ARGS[@]}"
