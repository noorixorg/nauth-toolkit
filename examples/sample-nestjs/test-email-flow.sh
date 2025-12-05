#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  📧 Testing Email Verification Flow                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check if server is running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Server not running at http://localhost:3000${NC}"
  echo "   Start it with: yarn start"
  exit 1
fi

echo -e "${BLUE}Step 1: Signup new user${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Generate random email to avoid conflicts
RANDOM_EMAIL="test$(date +%s)@example.com"
echo "Using email: $RANDOM_EMAIL"

SIGNUP_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"SecurePass123!\",\"username\":\"testuser\"}")

echo "$SIGNUP_RESPONSE" | jq '.' 2>/dev/null || echo "$SIGNUP_RESPONSE"

# Extract access token
ACCESS_TOKEN=$(echo "$SIGNUP_RESPONSE" | jq -r '.accessToken' 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  echo -e "${YELLOW}❌ Failed to get access token. Check response above.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Signup successful!${NC}"
echo "Access Token: ${ACCESS_TOKEN:0:30}..."
echo ""

echo -e "${BLUE}Step 2: Send verification email${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

VERIFY_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/verify-email/send \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"
echo ""

echo -e "${GREEN}✅ Verification email sent!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}Step 3: Get verification code from test endpoint${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get verification code from test endpoint
VERIFICATION_CODE=$(curl -s "http://localhost:3000/test/email/latest?email=$RANDOM_EMAIL" | jq -r '.code' 2>/dev/null)

if [ -z "$VERIFICATION_CODE" ] || [ "$VERIFICATION_CODE" = "null" ] || [ "$VERIFICATION_CODE" = "" ]; then
  echo -e "${YELLOW}⚠️  No verification code found yet. Wait a moment and try:${NC}"
  echo ""
  echo "curl -s \"http://localhost:3000/test/email/latest?email=$RANDOM_EMAIL\" | jq -r '.code'"
  echo ""
  echo "Or check console logs if using ConsoleEmailProvider"
  VERIFICATION_CODE=""
else
  echo -e "${GREEN}✅ Verification code retrieved: $VERIFICATION_CODE${NC}"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${BLUE}Step 4: Verify email with code${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  VERIFY_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/verify-email/verify \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"code\":\"$VERIFICATION_CODE\"}")

  echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"

  if echo "$VERIFY_RESPONSE" | jq -e '.message' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Email verified successfully!${NC}"
  else
    echo -e "${YELLOW}⚠️  Verification may have failed. Check response above.${NC}"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}Manual verification (if needed):${NC}"
echo ""
echo "curl -X POST http://localhost:3000/auth/verify-email/verify \\"
echo "  -H \"Authorization: Bearer $ACCESS_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"code\":\"YOUR_6_DIGIT_CODE\"}'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}To check verification status:${NC}"
echo ""
echo "curl -X GET http://localhost:3000/auth/me \\"
echo "  -H \"Authorization: Bearer $ACCESS_TOKEN\""
echo ""
echo "Look for: \"isEmailVerified\": true"
echo ""

# Save token to file for convenience
echo "$ACCESS_TOKEN" > .last_access_token
echo -e "${GREEN}💾 Access token saved to .last_access_token${NC}"
echo ""

