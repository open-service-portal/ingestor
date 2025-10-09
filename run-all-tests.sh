#!/usr/bin/env bash
# Run all XRD Transform tests: Feature + E2E

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Running All XRD Transform Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

FEATURE_FAILED=0
E2E_FAILED=0

# Run feature tests
echo -e "${BLUE}→ Feature Tests (using test templates)${NC}"
echo ""
if "${SCRIPT_DIR}/run-feature-tests.sh"; then
  echo -e "${GREEN}✓ Feature tests passed${NC}"
else
  FEATURE_FAILED=1
  echo -e "${RED}✗ Feature tests failed${NC}"
fi

echo ""
echo -e "${BLUE}→ E2E Tests (using production templates)${NC}"
echo ""
if "${SCRIPT_DIR}/run-e2e-tests.sh"; then
  echo -e "${GREEN}✓ E2E tests passed${NC}"
else
  E2E_FAILED=1
  echo -e "${RED}✗ E2E tests failed${NC}"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Overall Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

if [ $FEATURE_FAILED -eq 0 ] && [ $E2E_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  [ $FEATURE_FAILED -ne 0 ] && echo -e "${RED}✗ Feature tests failed${NC}"
  [ $E2E_FAILED -ne 0 ] && echo -e "${RED}✗ E2E tests failed${NC}"
  exit 1
fi
