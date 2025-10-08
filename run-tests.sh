#!/usr/bin/env bash

# XRD Transform Test Suite - Diff-Based Testing
# Compares actual transform output against expected YAML files

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FIXTURES_DIR="${SCRIPT_DIR}/tests/xrd-transform/fixtures"
EXPECTED_DIR="${SCRIPT_DIR}/tests/xrd-transform/expected"
OUTPUT_DIR="${SCRIPT_DIR}/tests/xrd-transform/output"
TRANSFORM_SCRIPT="${SCRIPT_DIR}/scripts/xrd-transform.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
TOTAL=0

# Cleanup and setup
rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  XRD Transform Test Suite - Diff-Based Testing${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check if transform script exists
if [ ! -f "${TRANSFORM_SCRIPT}" ]; then
  echo -e "${RED}✗ Transform script not found at: ${TRANSFORM_SCRIPT}${NC}"
  exit 1
fi

# Find all test fixtures
for fixture in "${FIXTURES_DIR}"/*.yaml; do
  [ -f "$fixture" ] || continue

  TOTAL=$((TOTAL + 1))

  test_name=$(basename "$fixture" .yaml)
  expected_file="${EXPECTED_DIR}/${test_name}.yaml"
  output_file="${OUTPUT_DIR}/${test_name}.yaml"

  echo -e "${YELLOW}Test: ${test_name}${NC}"

  # Check if expected output exists
  if [ ! -f "${expected_file}" ]; then
    echo -e "  ${RED}✗ Expected output not found: ${expected_file}${NC}"
    echo -e "  ${YELLOW}Run: ./scripts/xrd-transform.sh $fixture > $expected_file${NC}"
    FAILED=$((FAILED + 1))
    echo ""
    continue
  fi

  # Validate that expected file has warning header
  if ! grep -q "EXPECTED TEST OUTPUT" "${expected_file}"; then
    echo -e "  ${RED}✗ Expected file missing warning header${NC}"
    echo -e "  ${YELLOW}Expected files must have a warning header to prevent blind regeneration${NC}"
    echo -e "  ${YELLOW}Run: bash tests/xrd-transform/add-headers.sh${NC}"
    FAILED=$((FAILED + 1))
    echo ""
    continue
  fi

  # Run transform
  if ! "${TRANSFORM_SCRIPT}" "$fixture" > "$output_file" 2>&1; then
    echo -e "  ${RED}✗ Transform failed${NC}"
    echo "  Output:"
    cat "$output_file" | head -20
    FAILED=$((FAILED + 1))
    echo ""
    continue
  fi

  # Strip header comments from expected file for comparison
  # Remove everything from start until we see a line starting with "apiVersion:"
  expected_file_stripped="${OUTPUT_DIR}/${test_name}.expected-stripped.yaml"
  sed -n '/^apiVersion:/,$p' "${expected_file}" > "${expected_file_stripped}"

  # Compare outputs using diff (comparing stripped expected vs actual output)
  if diff -u "${expected_file_stripped}" "${output_file}" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Output matches expected${NC}"
    PASSED=$((PASSED + 1))
  else
    echo -e "  ${RED}✗ Output differs from expected${NC}"
    echo ""
    echo "  Differences:"
    diff -u "${expected_file_stripped}" "${output_file}" | head -30 || true
    echo ""
    echo -e "  ${YELLOW}Expected: ${expected_file}${NC}"
    echo -e "  ${YELLOW}Actual:   ${output_file}${NC}"
    echo -e "  ${YELLOW}To update expected output: cp ${output_file} ${expected_file}${NC}"
    echo -e "  ${RED}⚠️  WARNING: Do NOT blindly update! Review changes carefully first.${NC}"
    FAILED=$((FAILED + 1))
  fi

  echo ""
done

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "Total tests:  ${TOTAL}"
echo -e "${GREEN}Passed:       ${PASSED}${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Failed:       ${FAILED}${NC}"
else
  echo -e "Failed:       ${FAILED}"
fi
echo ""

# Exit with failure if any tests failed
if [ $FAILED -gt 0 ]; then
  exit 1
fi

exit 0
