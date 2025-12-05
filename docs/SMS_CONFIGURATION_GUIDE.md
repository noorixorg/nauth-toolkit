# SMS Provider Configuration Guide

Complete guide for configuring SMS providers (AWS End User Messaging, Twilio) with nauth-toolkit.

---

## 📋 Overview

nauth-toolkit supports multiple SMS providers for phone verification:

Note: The phone verification service (`PhoneVerificationService`) now ships with `@nauth-toolkit/core`.
Only SMS provider adapters are optional external packages.

| Provider | Type | Best For | Cost | Throughput |
|----------|------|----------|------|------------|
| **Console** | Development | Testing/Dev | Free | N/A |
| **AWS SNS** | Production | AWS users, global reach | $0.00645/SMS (US) | High |
| **Twilio** | Production | Highest reliability | $0.0079/SMS (US) | Very High |

---

## 🚀 Quick Start

### Option 1: Console Provider (Development)

No configuration needed! Just use defaults:

```typescript
// In AuthModule.forRoot()
import { createSMSProvider } from '@nauth-toolkit/core';

AuthModule.forRoot({
  // ... other config
  smsProvider: createSMSProvider(), // Defaults to console
});
```

Or explicitly:

```typescript
import { ConsoleSMSProvider } from '@nauth-toolkit/core';

AuthModule.forRoot({
  smsProvider: new ConsoleSMSProvider(),
});
```

### Option 2: AWS End User Messaging (Production)

```typescript
import { createSMSProvider } from '@nauth-toolkit/core';

AuthModule.forRoot({
  smsProvider: createSMSProvider({
    type: 'aws',
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    senderIdOrOriginationNumber: process.env.AWS_SMS_ORIGINATION_NUMBER,
    messageType: 'Transactional',
  }),
});
```

### Option 3: Auto-Configuration from Environment

```typescript
import { createSMSProvider } from '@nauth-toolkit/core';

// Automatically reads SMS_PROVIDER env var
AuthModule.forRoot({
  smsProvider: createSMSProvider(),
});
```

---

## 🔧 Environment Variables

### AWS End User Messaging

Create a `.env` file:

```bash
# ============================================================================
# SMS Provider Configuration (AWS End User Messaging)
# ============================================================================

# Provider type (console, aws, twilio)
SMS_PROVIDER=aws

# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Origination Number (REQUIRED for US/Canada)
# Must be E.164 format with + prefix
# Options:
# - Long code: +12345678901 (standard phone number)
# - Toll-free: +18001234567 (1-800 number)
# - Short code: 12345 (5-6 digits, no + prefix)
AWS_SMS_ORIGINATION_NUMBER=+12345678901

# OR Sender ID (for non-US countries)
# Alphanumeric name that appears as sender (3-11 characters)
# Note: Not supported in US/Canada
# AWS_SMS_SENDER_ID=MyApp

# Message Type (optional, default: Transactional)
# Options: Transactional (OTP, alerts) or Promotional (marketing)
AWS_SMS_MESSAGE_TYPE=Transactional

# Configuration Set (optional)
# For CloudWatch metrics and delivery tracking
# AWS_SMS_CONFIG_SET=my-sms-config-set

# Maximum Price per SMS in USD (optional)
# Prevents unexpected charges for expensive international SMS
# AWS_SMS_MAX_PRICE=0.50

# Default Country Code (optional, ISO 3166-1 alpha-2)
# AWS_SMS_DEFAULT_COUNTRY=US

# Enable Delivery Status Logging (optional, default: false)
# AWS_SMS_ENABLE_DELIVERY_LOGS=true
```

### Twilio (Coming Soon)

```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+12345678901
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 📱 AWS End User Messaging Setup

### Step 1: Create AWS Account

1. Sign up at https://aws.amazon.com/
2. Navigate to AWS Console
3. Search for "SNS" (Simple Notification Service)

### Step 2: Create IAM User

1. Go to **IAM Console** → **Users** → **Create User**
2. User name: `nauth-sms-sender`
3. Enable **Programmatic access**
4. Click **Next: Permissions**

### Step 3: Attach IAM Policy

Create a custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSNSPublish",
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "*"
    }
  ]
}
```

Or use AWS managed policy: `SNSSendSMSPermissions`

### Step 4: Save Credentials

**⚠️ IMPORTANT:** Save these immediately (they're shown only once):
- **Access Key ID** → `AWS_ACCESS_KEY_ID`
- **Secret Access Key** → `AWS_SECRET_ACCESS_KEY`

### Step 5: Request Production Access

By default, AWS SNS is in **sandbox mode** (limited sending).

1. Go to **SNS Console** → **Text messaging (SMS)** → **Production access**
2. Click **Request production access**
3. Fill out form:
   - **Use case:** Phone verification for user authentication
   - **Monthly volume:** Estimate your expected SMS volume
   - **Compliance:** Confirm opt-in/opt-out compliance
4. Submit request
5. **Approval time:** Usually within 24 hours

### Step 6A: Register Origination Number (US/Canada)

**Required for US and Canada.** Choose one:

#### Option A: Long Code (Standard Phone Number)
- **Cost:** ~$1-2/month + per-SMS cost
- **Throughput:** 1 SMS/second
- **Best for:** Low-medium volume (<100 SMS/day)
- **Setup:**
  1. AWS Console → **Pinpoint** → **SMS and voice** → **Phone numbers**
  2. Click **Request phone number**
  3. Select country (US) and number type (Long code)
  4. Complete registration form
  5. Wait for approval (1-2 weeks)

#### Option B: Toll-Free Number
- **Cost:** ~$2/month + $0.0075/SMS
- **Throughput:** 3 SMS/second
- **Best for:** Medium volume (100-1000 SMS/day)
- **Setup:** Same as long code, select "Toll-free" type

#### Option C: Short Code
- **Cost:** $650-1000/month + per-SMS cost
- **Throughput:** 100 SMS/second
- **Best for:** High volume (10K+ SMS/day)
- **Setup:** Separate application process (3-8 weeks approval)

**Example:**
```bash
AWS_SMS_ORIGINATION_NUMBER=+12065551234  # Long code
AWS_SMS_ORIGINATION_NUMBER=+18885551234  # Toll-free
AWS_SMS_ORIGINATION_NUMBER=12345         # Short code (no + prefix)
```

### Step 6B: Register Sender ID (Non-US Countries)

**For countries OTHER than US/Canada.**

1. Check if your country supports sender IDs:
   - https://docs.aws.amazon.com/sns/latest/dg/sns-supported-regions-countries.html
2. Choose alphanumeric name (3-11 characters)
3. Some countries require registration (India, UAE, etc.)
4. Register sender ID with AWS Support

**Example:**
```bash
AWS_SMS_SENDER_ID=MyApp      # Appears as "MyApp" in SMS
AWS_SMS_SENDER_ID=YourBrand  # Appears as "YourBrand"
```

### Step 7: Set Spend Limits

1. Go to **SNS Console** → **Text messaging (SMS)** → **Text messaging preferences**
2. Find **Account spending limit**
3. Set monthly limit (default: $1.00/month)
4. Recommended for production: $100-1000/month

**Why?** Prevents unexpected charges from SMS abuse or bugs.

### Step 8: Create Configuration Set (Optional)

Enable monitoring and delivery tracking:

1. Go to **SNS Console** → **Configuration sets** → **Create**
2. Name: `nauth-verification-sms`
3. Add event destinations:
   - **CloudWatch Logs:** For delivery status
   - **CloudWatch Metrics:** For success/failure rates
   - **Kinesis Firehose:** For archiving
4. Save configuration set name

**In .env:**
```bash
AWS_SMS_CONFIG_SET=nauth-verification-sms
```

### Step 9: Test SMS Delivery

Use nauth-toolkit phone verification endpoints:

```bash
# Send verification SMS
curl -X POST http://localhost:3000/auth/verify-phone/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"phone": "+12065551234"}'

# Check CloudWatch Logs for delivery status
# AWS Console → CloudWatch → Log groups → sns/
```

---

## 💰 AWS SMS Pricing (2024 Rates)

### Per-SMS Costs by Region

| Region | Price per SMS |
|--------|---------------|
| **United States** | $0.00645 |
| **Canada** | $0.00645 |
| **United Kingdom** | $0.0376 |
| **India** | $0.00200 |
| **Australia** | $0.0542 |
| **Germany** | $0.0766 |
| **France** | $0.0797 |
| **Japan** | $0.0797 |

### Additional Costs

| Item | Cost |
|------|------|
| Long Code | $1-2/month |
| Toll-Free Number | $2/month + $0.0075/SMS |
| Short Code | $650-1000/month |
| Message Parts | $0.00645/part (>160 chars) |

### Cost Examples

**1,000 verification SMS/month (US):**
- SMS cost: 1,000 × $0.00645 = **$6.45/month**
- Long code: +$1/month
- **Total: ~$7.50/month**

**10,000 verification SMS/month (US):**
- SMS cost: 10,000 × $0.00645 = **$64.50/month**
- Toll-free: +$2/month + (10,000 × $0.0075) = +$77/month
- **Total: ~$141.50/month**

### Cost Optimization Tips

1. **Use short codes for high volume** (100+ SMS/sec)
2. **Set max price limit** to avoid expensive international SMS
3. **Monitor CloudWatch metrics** to track costs
4. **Use message templates** to keep SMS under 160 characters
5. **Block expensive countries** if not needed

---

## 🔒 Security Best Practices

### 1. Secure Credential Storage

**❌ DON'T:**
```typescript
// Hardcoded credentials (NEVER do this!)
smsProvider: new AWSSMSProvider({
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  // ...
});
```

**✅ DO:**
```typescript
// Environment variables
smsProvider: new AWSSMSProvider({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  // ...
});
```

**✅ BETTER:**
```bash
# Use AWS IAM roles (no credentials needed!)
# For ECS/EC2/Lambda deployments
```

### 2. IAM Least Privilege

Only grant `sns:Publish` permission:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["sns:Publish"],
      "Resource": "*"
    }
  ]
}
```

**Don't grant:**
- `sns:*` (too broad)
- `sns:DeleteTopic`
- `sns:Subscribe`

### 3. Rate Limiting

Implement rate limiting to prevent SMS abuse:

```typescript
AuthModule.forRoot({
  phone: {
    verification: {
      enabled: true,
      resendDelay: 60,     // 60 seconds between resends
      resendLimit: 3,      // Max 3 resends per hour
      maxAttempts: 3,      // Max 3 verification attempts
    },
  },
});
```

### 4. Phone Number Validation

Always validate phone numbers before sending:

```typescript
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';

// Validate E.164 format
if (!isValidPhoneNumber(phone, 'US')) {
  throw new Error('Invalid phone number');
}

// Parse and format
const parsed = parsePhoneNumber(phone, 'US');
const e164 = parsed.format('E.164'); // +12065551234
```

### 5. Monitor Delivery Failures

Track failed SMS deliveries:

```typescript
// Enable delivery status logging
AWS_SMS_ENABLE_DELIVERY_LOGS=true
```

Check CloudWatch Logs for:
- Invalid phone numbers
- Carrier rejections
- Number blocks

---

## 🐛 Troubleshooting

### Error: "Invalid credentials"

**Cause:** Wrong AWS credentials or expired access key.

**Fix:**
1. Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
2. Check IAM user is active
3. Generate new credentials if expired

### Error: "Authorization error"

**Cause:** IAM user lacks `sns:Publish` permission.

**Fix:**
1. Go to IAM → Users → Permissions
2. Attach policy with `sns:Publish` action
3. Wait 30 seconds for propagation

### Error: "Sender ID not registered"

**Cause:** Using sender ID in a country that requires registration.

**Fix:**
1. Check country requirements: https://docs.aws.amazon.com/sns/latest/dg/sns-supported-regions-countries.html
2. Register sender ID with AWS Support
3. Or use origination number instead

### Error: "Daily spend limit exceeded"

**Cause:** Hit AWS account spending limit.

**Fix:**
1. Go to SNS Console → Text messaging preferences
2. Increase **Account spending limit**
3. Wait for limit to reset (midnight UTC)

### Error: "Phone number not valid"

**Cause:** Phone number not in E.164 format.

**Fix:**
```typescript
// ❌ Wrong
const phone = '206-555-1234';

// ✅ Correct
const phone = '+12065551234'; // E.164 with + prefix
```

### SMS not delivered (no error)

**Possible causes:**
1. Number is blocked/invalid
2. Carrier rejected message
3. Still in sandbox mode (request production access)

**Debug:**
1. Enable delivery logs: `AWS_SMS_ENABLE_DELIVERY_LOGS=true`
2. Check CloudWatch Logs: `sns/us-east-1/...`
3. Look for delivery receipts

---

## 📊 Monitoring & Analytics

### CloudWatch Metrics

Track SMS performance:

```bash
# View SMS delivery rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/SNS \
  --metric-name SMSSuccessRate \
  --dimensions Name=SMSType,Value=Transactional \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-31T23:59:59Z \
  --period 86400 \
  --statistics Average
```

**Key metrics:**
- `SMSSuccessRate` - Delivery success rate
- `SMSMonthToDateSpentUSD` - Current month spend
- `NumberOfMessagesPublished` - Total SMS sent

### Custom Logging

Log SMS events in your app:

```typescript
import { NAuthLogger } from '@nauth-toolkit/core';

const logger = new NAuthLogger();

// After sending SMS
logger.log(`SMS sent to ${phone} (masked: ${maskPhone(phone)})`);

// On delivery failure
logger.error(`SMS delivery failed to ${maskPhone(phone)}: ${error}`);

// Mask phone: +12065551234 → +120***1234
function maskPhone(phone: string): string {
  return phone.replace(/(\+\d{3})\d+(\d{4})/, '$1***$2');
}
```

---

## 🚀 Production Checklist

Before going live:

- [ ] AWS production access approved
- [ ] Origination number registered (US/Canada)
- [ ] IAM credentials secured in environment variables
- [ ] Spend limits configured ($100-1000/month)
- [ ] Configuration set created (monitoring)
- [ ] Delivery status logging enabled
- [ ] Rate limiting implemented (3 SMS/hour)
- [ ] Phone validation added (E.164 format)
- [ ] Test SMS sent successfully
- [ ] CloudWatch alarms configured
- [ ] Error handling implemented
- [ ] Cost monitoring dashboard set up

---

## 📚 Additional Resources

**AWS Documentation:**
- SNS SMS Guide: https://docs.aws.amazon.com/sns/latest/dg/sns-mobile-phone-number-as-subscriber.html
- Country SMS Support: https://docs.aws.amazon.com/sns/latest/dg/sns-supported-regions-countries.html
- Pricing: https://aws.amazon.com/sns/sms-pricing/

**nauth-toolkit Documentation:**
- Phone Verification API: `/docs/API.md#phone-verification`
- Configuration Reference: `/docs/NESTJS_AUTH_TOOLKIT_REQUIREMENTS.md`

**Support:**
- AWS Support: https://console.aws.amazon.com/support/
- GitHub Issues: https://github.com/your-repo/nauth-toolkit/issues

---

**🎉 You're ready to send production SMS with nauth-toolkit!**

