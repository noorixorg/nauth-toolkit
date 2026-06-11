#!/bin/bash

# Helper script to run Playwright scenarios with proper configuration
# Usage: ./run-scenario.sh <scenario-id> [options]
# Options:
#   --headed    Run in headed mode (visible browser)
#   --ui        Run with Playwright UI
#   --slowmo N  Set slow motion delay in ms (default: 1000)
#   --grep      Use grep pattern instead of scenario ID

SCENARIO_ID="$1"
shift

# Default options
HEADED=false
UI=false
SLOWMO=1000
GREP=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --headed)
      HEADED=true
      shift
      ;;
    --ui)
      UI=true
      shift
      ;;
    --slowmo)
      SLOWMO="$2"
      shift 2
      ;;
    --grep)
      GREP="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Map scenario IDs to their required environment variables
declare -A SCENARIO_CONFIGS=(
  ["signup-basic"]="VERIFICATION_METHOD=none MFA_ENABLED=false MFA_ENFORCEMENT=OPTIONAL"
  ["signup-email-verification"]="VERIFICATION_METHOD=email MFA_ENABLED=false MFA_ENFORCEMENT=OPTIONAL"
  ["signup-phone-verification"]="VERIFICATION_METHOD=phone MFA_ENABLED=false MFA_ENFORCEMENT=OPTIONAL"
  ["signup-both-verification"]="VERIFICATION_METHOD=both MFA_ENABLED=false MFA_ENFORCEMENT=OPTIONAL"
  ["signup-mfa-required-sms"]="VERIFICATION_METHOD=none MFA_ENABLED=true MFA_ENFORCEMENT=REQUIRED"
  ["signup-mfa-required-totp"]="VERIFICATION_METHOD=none MFA_ENABLED=true MFA_ENFORCEMENT=REQUIRED"
  ["signup-mfa-optional-totp"]="VERIFICATION_METHOD=none MFA_ENABLED=true MFA_ENFORCEMENT=OPTIONAL"
  ["login-basic"]="VERIFICATION_METHOD=none MFA_ENABLED=false MFA_ENFORCEMENT=OPTIONAL"
  ["login-mfa-required-totp"]="VERIFICATION_METHOD=none MFA_ENABLED=true MFA_ENFORCEMENT=REQUIRED"
)

# Build command
CMD="cd e2e"

# Set environment variables
if [ -n "$GREP" ]; then
  # If using grep, don't set scenario-specific env vars
  ENV_VARS=""
else
  ENV_VARS="${SCENARIO_CONFIGS[$SCENARIO_ID]}"
  if [ -z "$ENV_VARS" ]; then
    echo "Unknown scenario: $SCENARIO_ID"
    echo "Available scenarios:"
    for key in "${!SCENARIO_CONFIGS[@]}"; do
      echo "  - $key"
    done
    exit 1
  fi
fi

# Build Playwright command
PLAYWRIGHT_CMD="npx playwright test"
if [ -n "$GREP" ]; then
  PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --grep \"$GREP\""
elif [ -n "$SCENARIO_ID" ]; then
  PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --grep \"$SCENARIO_ID\""
fi

if [ "$HEADED" = true ]; then
  PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --headed"
fi

if [ "$UI" = true ]; then
  PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --ui"
fi

# Set timeout
PLAYWRIGHT_CMD="timeout 180 $PLAYWRIGHT_CMD"

# Execute
if [ -n "$ENV_VARS" ]; then
  eval "$ENV_VARS SLOWMO=$SLOWMO $CMD && $PLAYWRIGHT_CMD"
else
  eval "SLOWMO=$SLOWMO $CMD && $PLAYWRIGHT_CMD"
fi
