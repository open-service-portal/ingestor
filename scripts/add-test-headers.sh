#!/usr/bin/env bash
# Add protective headers to test assertion files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEST_DIR="${PLUGIN_DIR}/tests"

# Test purposes
declare -A purposes=(
  ["scope/namespaced"]="Validates that Namespaced scope XRDs include namespace parameter"
  ["scope/cluster"]="Validates that Cluster-scoped XRDs exclude namespace parameter"
  ["multi-templates/output-blocks"]="Tests YAML merge with two output templates (download + pr)"
  ["yaml-merge/three-templates"]="Tests three-way YAML merge (default + download + pr)"
  ["annotations/tags"]="Validates tag extraction from openportal.dev/tags annotation"
  ["annotations/description"]="Validates custom description from backstage.io/description"
  ["annotations/owner"]="Validates owner specification from backstage.io/owner"
  ["helpers/slugify"]="Tests slugify helper converts dots and capitals to lowercase-hyphenated"
  ["helpers/replace"]="Tests replace helper for string transformation (dots to hyphens)"
  ["helpers/conditionals"]="Tests conditional rendering based on XRD scope"
  ["properties/types"]="Validates property extraction for string, integer, boolean, array types"
  ["properties/required"]="Tests required vs optional field detection in OpenAPI schema"
  ["properties/enum"]="Validates enum property extraction with default values"
  ["e2e/namespace"]="End-to-end test with template-namespace XRD using production templates"
  ["e2e/whoami"]="End-to-end test with template-whoami XRD using production templates"
)

# Process all assert files
for scenario_dir in "${TEST_DIR}"/*/ ; do
  scenario_name=$(basename "${scenario_dir}")
  [[ "$scenario_name" == "output" ]] && continue
  [[ "$scenario_name" == "templates" ]] && continue

  for assert_file in "${scenario_dir}"/assert-*.yaml ; do
    [[ ! -f "$assert_file" ]] && continue

    test_case=$(basename "$assert_file" .yaml | sed 's/^assert-//')
    test_key="${scenario_name}/${test_case}"
    purpose="${purposes[$test_key]}"

    # Skip if already has header
    if head -1 "$assert_file" | grep -q "^# TEST ASSERTION"; then
      echo "Skipping $test_key (already has header)"
      continue
    fi

    echo "Adding header to $test_key"

    # Create temp file with header
    cat > "${assert_file}.tmp" << EOF
# TEST ASSERTION - DO NOT BLINDLY REGENERATE
#
# Test: ${test_case}
# Purpose: ${purpose:-No purpose documented}
# Scenario: ${scenario_name}
#
# This file contains the EXPECTED output for this test case.
# It should only be updated when:
#   1. Adding NEW features that intentionally change output
#   2. Fixing BUGS where the old output was incorrect
#   3. Modifying templates with a clear, documented purpose
#
# NEVER blindly regenerate this file without understanding WHY the output changed!
#
# To update after reviewing changes:
#   cp tests/output/${scenario_name}-${test_case}.yaml tests/${scenario_name}/assert-${test_case}.yaml
#
# This header will be stripped during test comparison.
# ---

EOF

    # Append original content
    cat "$assert_file" >> "${assert_file}.tmp"

    # Replace original
    mv "${assert_file}.tmp" "$assert_file"
  done
done

echo "Headers added successfully!"
