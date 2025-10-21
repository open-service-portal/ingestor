#!/usr/bin/env bash
# XRD Transform Test Runner
# Runs all tests in scenario folders, matching test-*.yaml with assert-*.yaml

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="${SCRIPT_DIR}/tests"
OUTPUT_DIR="${TEST_DIR}/output"
TRANSFORM_SCRIPT="${SCRIPT_DIR}/scripts/xrd-transform.sh"
TEST_TEMPLATES="${TEST_DIR}/templates"
TEST_CONFIG="${TEST_DIR}/app-config.test.yaml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Stats
PASSED=0
FAILED=0
SCENARIOS=0

# Cleanup
rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  XRD Transform Test Suite${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Find all scenario directories
for scenario_dir in "${TEST_DIR}"/*/ ; do
  # Skip output and templates directories
  scenario_name=$(basename "${scenario_dir}")
  [[ "$scenario_name" == "output" ]] && continue
  [[ "$scenario_name" == "templates" ]] && continue

  # Find test files in this scenario
  test_files=($(find "${scenario_dir}" -name "test-*.yaml" 2>/dev/null | sort))

  if [ ${#test_files[@]} -eq 0 ]; then
    continue
  fi

  SCENARIOS=$((SCENARIOS + 1))
  echo -e "${BLUE}Scenario: ${scenario_name}${NC}"

  for test_file in "${test_files[@]}"; do
    test_name=$(basename "${test_file}" .yaml)
    test_case="${test_name#test-}"  # Remove 'test-' prefix

    echo -e "  ${YELLOW}${test_case}${NC}"

    # Determine template directory (e2e uses production, others use test templates)
    if [[ "$scenario_name" == "e2e" ]]; then
      template_dir="${SCRIPT_DIR}/templates"
    else
      template_dir="${TEST_TEMPLATES}"
    fi

    # Transform
    output_file="${OUTPUT_DIR}/${scenario_name}-${test_case}.yaml"
    if ! "${TRANSFORM_SCRIPT}" --config "${TEST_CONFIG}" --template-path "${template_dir}" "${test_file}" > "${output_file}" 2>&1; then
      echo -e "    ${RED}✗ Transform failed${NC}"
      cat "${output_file}" | head -10
      FAILED=$((FAILED + 1))
      continue
    fi

    # Find expected file
    assert_file="${scenario_dir}/assert-${test_case}.yaml"

    if [ ! -f "${assert_file}" ]; then
      echo -e "    ${YELLOW}⚠ No assertion (new test)${NC}"
      echo -e "    ${YELLOW}To accept: cp ${output_file} ${assert_file}${NC}"
      FAILED=$((FAILED + 1))
      continue
    fi

    # Strip headers from assert file for comparison
    # Headers start with "# TEST ASSERTION" and end with "# ---", followed by blank line
    assert_stripped="${OUTPUT_DIR}/.assert-${test_case}-stripped.yaml"
    sed '1,/^# ---$/d' "${assert_file}" | sed '1{/^$/d;}' > "${assert_stripped}"

    # Compare
    if diff -u "${assert_stripped}" "${output_file}" > /dev/null 2>&1; then
      echo -e "    ${GREEN}✓ Pass${NC}"
      PASSED=$((PASSED + 1))
    else
      echo -e "    ${RED}✗ Fail${NC}"
      diff -u "${assert_stripped}" "${output_file}" | head -20
      echo -e "    ${YELLOW}To update: cp ${output_file} ${assert_file}${NC}"
      echo -e "    ${YELLOW}          (then manually add header using scripts/add-test-headers.sh)${NC}"
      FAILED=$((FAILED + 1))
    fi
  done

  echo ""
done

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo "Scenarios: ${SCENARIOS}"
TOTAL=$((PASSED + FAILED))
echo "Total:     ${TOTAL}"
echo -e "${GREEN}Passed:    ${PASSED}${NC}"
if [ "${FAILED}" -gt 0 ]; then
  echo -e "${RED}Failed:    ${FAILED}${NC}"
  exit 1
else
  echo "Failed:    0"
  exit 0
fi
