#!/usr/bin/env node

/**
 * Build Script: MJML Templates → Handlebars Templates
 *
 * Compiles MJML master + content templates into final .hbs files
 * that can be used by the HandlebarsTemplateEngine.
 */

const fs = require('fs');
const path = require('path');
const mjml = require('mjml');

// Template subjects
const SUBJECTS = {
  verification: 'Email Verification - {{appName}}',
  'password-reset': 'Password Reset - {{appName}}',
  welcome: 'Welcome to {{appName}}!',
  'account-lockout': 'Account Locked - {{appName}}',
  'new-device': 'New Device Login - {{appName}}',
  'password-changed': 'Password Changed - {{appName}}',
  'email-changed': 'Email Address Changed - {{appName}}',
  'mfa-enabled': 'Two-Factor Authentication Enabled - {{appName}}',
};

// Template preview texts
const PREVIEW_TEXTS = {
  verification: 'Verify your email address to activate your account',
  'password-reset': 'Reset your password to regain access to your account',
  welcome: 'Welcome! Your account is ready to use',
  'account-lockout': 'Your account has been temporarily locked for security',
  'new-device': 'We detected a login from a new device',
  'password-changed': 'Your password has been successfully changed',
  'email-changed': 'Your email address has been successfully changed',
  'mfa-enabled': 'Two-factor authentication has been enabled for your account',
};

// Text versions (plain text fallbacks)
const TEXT_TEMPLATES = {
  verification: `Email Verification

{{#if fullName}}Hi {{fullName}},{{/if}}
{{#if firstName}}Hi {{firstName}},{{/if}}
{{#if lastName}}Hi {{lastName}},{{/if}}
{{#if userName}}Hi {{userName}},{{/if}}

Thank you for signing up! Please verify your email address to activate your account.

{{#if code}}Your Verification Code: {{code}}{{/if}}

{{#if link}}Or use this link: {{link}}{{/if}}

{{#if expiryMinutes}}This code expires in {{expiryMinutes}} minutes.{{/if}}

If you didn't request this verification, please ignore this email.`,
  'password-reset': `Password Reset

{{#if fullName}}Hi {{fullName}},{{/if}}
{{#if firstName}}Hi {{firstName}},{{/if}}
{{#if lastName}}Hi {{lastName}},{{/if}}
{{#if userName}}Hi {{userName}},{{/if}}

We received a request to reset your password. Use the link below to create a new password:

{{link}}

{{#if expiryMinutes}}This link expires in {{expiryMinutes}} minutes.{{/if}}

If you didn't request a password reset, your account is secure and you can ignore this email.`,
  welcome: `Welcome to {{appName}}!

{{#if fullName}}Hi {{fullName}},{{/if}}
{{#if firstName}}Hi {{firstName}},{{/if}}
{{#if lastName}}Hi {{lastName}},{{/if}}
{{#if userName}}Hi {{userName}},{{/if}}

We're excited to have you with us! Your account has been successfully created and you're ready to get started.

{{#if dashboardUrl}}Visit: {{dashboardUrl}}{{/if}}

{{#if supportEmail}}If you have any questions or need assistance, reach out to our support team at {{supportEmail}}.{{/if}}

Happy exploring!`,
  'account-lockout': `Account Locked

{{#if fullName}}Hi {{fullName}},{{/if}}
{{#if firstName}}Hi {{firstName}},{{/if}}
{{#if lastName}}Hi {{lastName}},{{/if}}
{{#if userName}}Hi {{userName}},{{/if}}

Your account has been temporarily locked for security reasons.

{{#if reason}}Reason: {{reason}}{{/if}}
{{#if durationMinutes}}Duration: Your account will be automatically unlocked in {{durationMinutes}} minutes.{{/if}}

What happened?
We detected multiple failed login attempts or suspicious activity on your account.

What should I do?
- {{#if durationMinutes}}Wait {{durationMinutes}} minutes for automatic unlock{{/if}}
- If this was you, try logging in again after the lockout period
- {{#if supportEmail}}If this wasn't you, contact support at {{supportEmail}}{{/if}}
- Consider changing your password after unlock`,
  'new-device': `New Device Login

{{#if fullName}}Hi {{fullName}},{{/if}}
{{#if firstName}}Hi {{firstName}},{{/if}}
{{#if lastName}}Hi {{lastName}},{{/if}}
{{#if userName}}Hi {{userName}},{{/if}}

We detected a login to your account from a new device.

{{#if deviceName}}Device: {{deviceName}}{{/if}}
{{#if deviceType}}Type: {{deviceType}}{{/if}}
{{#if ipAddress}}IP Address: {{ipAddress}}{{/if}}
{{#if location}}Location: {{location}}{{/if}}
{{#if timestamp}}Time: {{timestamp}}{{/if}}

Was this you?
If you recognize this login, no action is needed.

Not you?
If you don't recognize this activity, secure your account immediately:
- Change your password
- Review your recent account activity
- {{#if supportEmail}}Contact support at {{supportEmail}}{{/if}}`,
  'password-changed': `Password Changed

{{#if fullName}}Hi {{fullName}},{{/if}}
{{#if firstName}}Hi {{firstName}},{{/if}}
{{#if lastName}}Hi {{lastName}},{{/if}}
{{#if userName}}Hi {{userName}},{{/if}}

Your password has been successfully changed.

If you made this change, no further action is required.

{{#if supportEmail}}If you didn't make this change, please contact support immediately at {{supportEmail}}.{{/if}}`,
  'email-changed': `Email Address Changed

{{#if fullName}}Hi {{fullName}},{{/if}}
{{#if firstName}}Hi {{firstName}},{{/if}}
{{#if lastName}}Hi {{lastName}},{{/if}}
{{#if userName}}Hi {{userName}},{{/if}}

Your email address has been successfully changed to {{userEmail}}.

If you made this change, no further action is required.

{{#if supportEmail}}If you didn't make this change, please contact support immediately at {{supportEmail}}.{{/if}}`,
  'mfa-enabled': `Two-Factor Authentication Enabled

{{#if fullName}}Hi {{fullName}},{{/if}}
{{#if firstName}}Hi {{firstName}},{{/if}}
{{#if lastName}}Hi {{lastName}},{{/if}}
{{#if userName}}Hi {{userName}},{{/if}}

Two-factor authentication has been successfully enabled for your account.

Your account is now more secure. You'll need to provide both your password and a verification code when logging in.

{{#if supportEmail}}If you didn't enable this feature, please contact support immediately at {{supportEmail}}.{{/if}}`,
};

const MJML_DIR = __dirname;
// Output to src/templates/default (one level up from mjml folder)
const OUTPUT_DIR = path.resolve(MJML_DIR, '..', 'default');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Read and merge master + content templates
 *
 * Reads content template and replaces mj-include with actual content
 */
function mergeTemplates(contentTemplate) {
  const masterPath = path.join(MJML_DIR, 'master.mjml');
  let masterContent = fs.readFileSync(masterPath, 'utf-8');
  const contentPath = path.join(MJML_DIR, 'content', `${contentTemplate}.mjml`);
  const content = fs.readFileSync(contentPath, 'utf-8');

  // Replace mj-include tag with actual content
  // Pattern: <mj-include path="./content/{{templateName}}.mjml" />
  const includePattern = /<mj-include\s+path="[^"]*"\s*\/>/;
  masterContent = masterContent.replace(includePattern, content);

  return masterContent;
}

/**
 * Compile MJML to HTML
 */
function compileMJML(mjmlContent) {
  const result = mjml(mjmlContent, {
    minify: false,
    validationLevel: 'soft', // Allow some flexibility
    juicePreserveTags: {
      'mj-style': true,
    },
  });

  if (result.errors && result.errors.length > 0) {
    console.warn(`MJML warnings for template:`, result.errors);
  }

  return result.html;
}

/**
 * Add frontmatter to HTML
 */
function addFrontmatter(html, subject) {
  return `---
subject: ${subject}
---
${html}`;
}

/**
 * Build all templates
 */
function buildTemplates() {
  const templates = Object.keys(SUBJECTS);

  console.log('Building MJML templates...\n');

  templates.forEach((templateName) => {
    try {
      // Merge master + content
      const mergedMJML = mergeTemplates(templateName);

      if (!mergedMJML || mergedMJML.length < 100) {
        throw new Error(`Failed to merge templates for ${templateName}`);
      }

      // Compile to HTML
      const html = compileMJML(mergedMJML);

      if (!html || html.length < 100) {
        throw new Error(`Failed to compile MJML for ${templateName}`);
      }

      // Add frontmatter
      const subject = SUBJECTS[templateName];
      const finalHtml = addFrontmatter(html, subject);

      // Write HTML file
      const htmlPath = path.join(OUTPUT_DIR, `${templateName}.html.hbs`);
      fs.writeFileSync(htmlPath, finalHtml, 'utf-8');
      console.log(`Built ${templateName}.html.hbs (${Math.round(finalHtml.length / 1024)}KB)`);

      // Write text file
      const textPath = path.join(OUTPUT_DIR, `${templateName}.text.hbs`);
      fs.writeFileSync(textPath, TEXT_TEMPLATES[templateName], 'utf-8');
      console.log(`Built ${templateName}.text.hbs`);
    } catch (error) {
      console.error(`Error building ${templateName}:`, error.message);
      console.error(error.stack);
      process.exit(1);
    }
  });

  console.log('\nAll templates built successfully!');
}

// Run build
buildTemplates();
