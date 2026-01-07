# SMS Provider Setup Example

Quick guide to set up SMS providers in your nauth-toolkit application.

---

##  Quick Start

### Option 1: Console Provider (Development)

**No configuration needed!** Perfect for testing.

```typescript
import { AuthModule, ConsoleSMSProvider } from '@nauth-toolkit/core';

@Module({
  imports: [
    AuthModule.forRoot({
      // ... other config
      smsProvider: new ConsoleSMSProvider(), // Logs to console
    }),
  ],
})
export class AppModule {}
```

### Option 2: AWS End User Messaging (Production)

**Install AWS SDK:**
```bash
yarn add @aws-sdk/client-sns
```

**Configure in `.env`:**
```bash
SMS_PROVIDER=aws
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
AWS_SMS_ORIGINATION_NUMBER=+12345678901
AWS_SMS_MESSAGE_TYPE=Transactional
```

**Auto-configuration:**
```typescript
import { AuthModule, createSMSProvider } from '@nauth-toolkit/core';

@Module({
  imports: [
    AuthModule.forRoot({
      // ... other config
      smsProvider: createSMSProvider(), // Auto-detects from .env
    }),
  ],
})
export class AppModule {}
```

**Or explicit configuration:**
```typescript
import { AuthModule, createSMSProvider } from '@nauth-toolkit/core';

@Module({
  imports: [
    AuthModule.forRoot({
      smsProvider: createSMSProvider({
        type: 'aws',
        region: process.env.AWS_REGION!,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        senderIdOrOriginationNumber: process.env.AWS_SMS_ORIGINATION_NUMBER!,
        messageType: 'Transactional',
        maxPricePerMessage: 0.50, // Optional: limit cost per SMS
        configurationSetName: 'my-sms-config', // Optional: for monitoring
      }),
    }),
  ],
})
export class AppModule {}
```

---

##  Complete `.env` Example

```bash
# ============================================================================
# SMS Provider Configuration
# ============================================================================

# Provider type (console, aws, twilio)
SMS_PROVIDER=aws

# ============================================================================
# AWS End User Messaging (SNS)
# ============================================================================

# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Origination Number (US/Canada - REQUIRED)
# Must be E.164 format with + prefix
# Purchase from AWS Pinpoint Console
AWS_SMS_ORIGINATION_NUMBER=+12065551234

# OR Sender ID (Non-US countries)
# Alphanumeric name (3-11 characters)
# Some countries require registration
# AWS_SMS_SENDER_ID=MyApp

# Message Type (optional, default: Transactional)
# Transactional: OTP, alerts (higher priority)
# Promotional: Marketing (lower priority)
AWS_SMS_MESSAGE_TYPE=Transactional

# Configuration Set (optional)
# For CloudWatch metrics and delivery tracking
# AWS_SMS_CONFIG_SET=my-verification-sms

# Max Price per SMS (optional, USD)
# Prevents unexpected charges for expensive international SMS
# AWS_SMS_MAX_PRICE=0.50

# Default Country Code (optional, ISO 3166-1 alpha-2)
# AWS_SMS_DEFAULT_COUNTRY=US

# Enable Delivery Status Logging (optional)
# AWS_SMS_ENABLE_DELIVERY_LOGS=true

# ============================================================================
# Phone Verification Settings (nauth-toolkit)
# ============================================================================

# Enable phone verification
PHONE_VERIFICATION_ENABLED=true

# OTP code length (4-8 digits)
PHONE_VERIFICATION_CODE_LENGTH=6

# Code expiry in seconds (default: 300 = 5 minutes)
PHONE_VERIFICATION_EXPIRES_IN=300

# Max attempts per code (default: 3)
PHONE_VERIFICATION_MAX_ATTEMPTS=3

# Delay between resends in seconds (default: 60)
PHONE_VERIFICATION_RESEND_DELAY=60

# Max resends per hour (default: 3)
PHONE_VERIFICATION_RESEND_LIMIT=3

# Signup verification requirement
# Options: none, email, phone, both, either
SIGNUP_VERIFICATION_METHOD=email
```

---

##  Configuration in `auth.config.ts`

```typescript
import { AuthModule, createSMSProvider } from '@nauth-toolkit/core';

@Module({
  imports: [
    AuthModule.forRoot({
      // ... JWT, password, etc.

      // SMS Provider (auto-configured from .env)
      smsProvider: createSMSProvider(),

      // Phone verification settings
      phone: {
        verification: {
          enabled: true,
          codeLength: 6,
          expiresIn: 300, // 5 minutes
          maxAttempts: 3,
          resendDelay: 60, // 1 minute
          resendLimit: 3, // 3 per hour
        },
      },

      // Signup verification requirement
      signup: {
        verificationMethod: 'email', // or 'phone', 'both', 'either', 'none'
      },
    }),
  ],
})
export class AppModule {}
```

---

##  Testing Phone Verification

### 1. Send Verification SMS

```bash
curl -X POST http://localhost:3000/auth/verify-phone/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-access-token>" \
  -d '{"phone": "+12065551234"}'
```

**Response:**
```json
{
  "message": "Verification code sent successfully",
  "expiresIn": 300
}
```

### 2. Verify Code

```bash
curl -X POST http://localhost:3000/auth/verify-phone/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-access-token>" \
  -d '{"phone": "+12065551234", "code": "123456"}'
```

**Response:**
```json
{
  "message": "Phone verified successfully"
}
```

### 3. Resend Code (if needed)

```bash
curl -X POST http://localhost:3000/auth/verify-phone/resend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-access-token>" \
  -d '{"phone": "+12065551234"}'
```

---

##  AWS SNS Setup (Step-by-Step)

### 1. Create AWS Account
Visit https://aws.amazon.com/ and sign up

### 2. Create IAM User
1. Go to IAM Console → Users → Create User
2. Name: `nauth-sms-sender`
3. Enable **Programmatic access**
4. Attach policy: `SNSSendSMSPermissions` or create custom:

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

5. Save **Access Key ID** and **Secret Access Key**

### 3. Request Production Access
1. SNS Console → Text messaging (SMS) → Production access
2. Fill out form (use case, volume estimate)
3. Wait for approval (usually 24 hours)

### 4. Register Origination Number (US/Canada)
1. AWS Pinpoint → SMS and voice → Phone numbers
2. Request phone number ($1-2/month)
3. Wait for approval (1-2 weeks)
4. Copy number in E.164 format: `+12065551234`

### 5. Set Spend Limits
1. SNS Console → Text messaging preferences
2. Set monthly spend limit ($100 recommended)
3. Save changes

### 6. Test SMS
Use nauth-toolkit endpoints to send test verification SMS.

---

##  AWS Pricing Reference

| Region | Per SMS | Long Code | Toll-Free |
|--------|---------|-----------|-----------|
| US | $0.00645 | $1-2/mo | $2/mo + $0.0075/SMS |
| Canada | $0.00645 | $1-2/mo | $2/mo + $0.0075/SMS |
| UK | $0.0376 | N/A | N/A |
| India | $0.00200 | N/A | N/A |

**Example Cost:**
- 1,000 SMS/month (US) = ~$7.50/month
- 10,000 SMS/month (US) = ~$65/month

---

##  Troubleshooting

### "Cannot find module '@aws-sdk/client-sns'"

**Fix:**
```bash
yarn add @aws-sdk/client-sns
```

### "Invalid credentials"

**Fix:**
1. Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env`
2. Check IAM user is active in AWS Console

### "Authorization error"

**Fix:**
1. Ensure IAM user has `sns:Publish` permission
2. Attach `SNSSendSMSPermissions` policy

### SMS not delivered

**Possible causes:**
1. Still in sandbox mode → Request production access
2. Invalid phone number → Must be E.164 format (`+12065551234`)
3. Carrier rejection → Check CloudWatch Logs

**Debug:**
```bash
AWS_SMS_ENABLE_DELIVERY_LOGS=true
```

Then check CloudWatch: AWS Console → CloudWatch → Log groups → `sns/`

---

##  Documentation

- **Full SMS Configuration Guide:** `/docs/SMS_CONFIGURATION_GUIDE.md`
- **AWS SNS Documentation:** https://docs.aws.amazon.com/sns/latest/dg/sns-mobile-phone-number-as-subscriber.html
- **nauth-toolkit Requirements:** `/docs/NESTJS_AUTH_TOOLKIT_REQUIREMENTS.md`

---

** You're ready to send production SMS with nauth-toolkit!**

For production deployments, always:
- - Use AWS SNS (not console provider)
- - Set spend limits
- - Enable delivery logs
- - Monitor CloudWatch metrics
- - Implement rate limiting (already built-in!)

