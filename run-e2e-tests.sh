#!/usr/bin/env bash
# E2E Tests - Integration tests using production templates
# Tests complete scenarios with actual template-namespace and template-whoami XRDs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="${SCRIPT_DIR}"
TRANSFORM_SCRIPT="${PLUGIN_DIR}/scripts/xrd-transform.sh"
FIXTURES_DIR="${PLUGIN_DIR}/tests/xrd-transform/fixtures"
OUTPUT_DIR="${PLUGIN_DIR}/tests/xrd-transform/output"
EXPECTED_DIR="${PLUGIN_DIR}/tests/xrd-transform/expected"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create output directory
mkdir -p "${OUTPUT_DIR}"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  XRD Transform E2E Tests${NC}"
echo -e "${BLUE}  Using production templates from: templates/${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

PASSED=0
FAILED=0

# Run only e2e-* fixtures (using production templates)
for fixture_file in "${FIXTURES_DIR}"/e2e-*.yaml; do
  if [ ! -f "${fixture_file}" ]; then
    echo -e "${YELLOW}No e2e test fixtures found${NC}"
    echo -e "${YELLOW}E2E tests use production templates with real XRDs${NC}"
    echo ""
    continue
  fi

  test_name=$(basename "${fixture_file}" .yaml)
  echo -e "${YELLOW}Test: ${test_name}${NC}"

  # Transform with PRODUCTION templates (default)
  output_file="${OUTPUT_DIR}/${test_name}.yaml"
  "${TRANSFORM_SCRIPT}" "${fixture_file}" > "${output_file}" 2>&1

  expected_file="${EXPECTED_DIR}/${test_name}.yaml"

  if [ ! -f "${expected_file}" ]; then
    echo -e "  ${YELLOW}⚠ No expected output found (new test)${NC}"
    echo -e "  ${YELLOW}Generated: ${output_file}${NC}"
    echo -e "  ${YELLOW}To accept: cp ${output_file} ${expected_file}${NC}"
    FAILED=$((FAILED + 1))
    echo ""
    continue
  fi

  # Validate header
  if ! grep -q "EXPECTED TEST OUTPUT" "${expected_file}"; then
    echo -e "  ${RED}✗ Expected file missing warning header${NC}"
    echo -e "  ${YELLOW}Run: bash tests/xrd-transform/add-headers.sh${NC}"
    FAILED=$((FAILED + 1))
    echo ""
    continue
  fi

  # Compare
  if diff -u "${expected_file}" "${output_file}" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Output matches expected${NC}"
    PASSED=$((PASSED + 1))
  else
    echo -e "  ${RED}✗ Output differs from expected${NC}"
    echo -e "  ${YELLOW}Diff:${NC}"
    diff -u "${expected_file}" "${output_file}" | head -30
    echo -e "  ${YELLOW}...${NC}"
    echo -e "  ${YELLOW}Expected: ${expected_file}${NC}"
    echo -e "  ${YELLOW}Actual:   ${output_file}${NC}"
    echo -e "  ${YELLOW}To update: cp ${output_file} ${expected_file}${NC}"
    echo -e "  ${RED}⚠️  WARNING: Review changes carefully first!${NC}"
    FAILED=$((FAILED + 1))
  fi

  echo ""
done

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  E2E Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
TOTAL=$((PASSED + FAILED))
echo "Total tests:  ${TOTAL}"
echo -e "${GREEN}Passed:       ${PASSED}${NC}"
if [ "${FAILED}" -gt 0 ]; then
  echo -e "${RED}Failed:       ${FAILED}${NC}"
else
  echo "Failed:       0"
fi

exit $((FAILED > 0 ? 1 : 0))
