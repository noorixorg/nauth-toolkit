/**
 * Template Validation Utility
 *
 * Validates custom templates to ensure they include all required parameters.
 * Provides clear error messages for missing parameters.
 */

import { TemplateType, CustomTemplateDefinition } from '../interfaces/template.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';

/**
 * Required parameters for each template type
 *
 * Maps template types to their required Handlebars variables.
 */
export const TEMPLATE_REQUIRED_PARAMS: Record<TemplateType, string[]> = {
  [TemplateType.VERIFICATION]: ['code', 'link', 'expiryMinutes'],
  [TemplateType.PASSWORD_RESET]: ['link', 'expiryMinutes'],
  [TemplateType.ADMIN_PASSWORD_RESET]: ['code', 'link', 'expiryMinutes'],
  [TemplateType.WELCOME]: [],
  [TemplateType.ACCOUNT_LOCKOUT]: ['reason', 'durationMinutes'],
  [TemplateType.NEW_DEVICE]: ['deviceName', 'timestamp'],
  [TemplateType.PASSWORD_CHANGED]: [],
  [TemplateType.EMAIL_CHANGED]: ['userEmail'],
  [TemplateType.MFA_ENABLED]: [],
  [TemplateType.MFA_DEVICE_REMOVED]: [],
  [TemplateType.MFA_METHOD_ADDED]: [],
  [TemplateType.ADAPTIVE_MFA_RISK_ALERT]: ['riskLevel', 'riskFactors'],
  [TemplateType.ACCOUNT_DISABLED]: ['reason'],
  [TemplateType.ACCOUNT_ENABLED]: [],
  [TemplateType.EMAIL_CHANGED_OLD]: [],
  [TemplateType.EMAIL_CHANGED_NEW]: [],
  [TemplateType.SESSIONS_REVOKED]: ['revokedCount'],
};

/**
 * Optional parameters available to all templates
 *
 * These can be used but are not required.
 * Injected by the template engine at runtime if available.
 */
export const TEMPLATE_OPTIONAL_PARAMS = [
  // User information
  'firstName',
  'lastName',
  'userName',
  'userEmail',
  'greetingName',

  // Global branding
  'appName',
  'companyName',
  'companyAddress',
  'brandColor',
  'logoUrl',
  'dashboardUrl',
  'supportEmail',

  // Social media
  'facebookUrl',
  'twitterUrl',
  'linkedinUrl',

  // Timestamps
  'currentYear',

  // Security alerts (device-specific)
  'deviceType',
  'ipAddress',
  'location',
];

/**
 * Validate template content for required parameters
 *
 * Scans template HTML/text for required Handlebars variables.
 * Throws error if any required parameters are missing.
 *
 * @param templateType - Type of template being validated
 * @param templateContent - HTML or text content to validate
 * @throws {NAuthException} If required parameters are missing
 *
 * @example
 * ```typescript
 * validateTemplateParams(
 *   TemplateType.VERIFICATION,
 *   '<html>{{code}} {{link}} {{expiryMinutes}}</html>'
 * ); // OK
 *
 * validateTemplateParams(
 *   TemplateType.VERIFICATION,
 *   '<html>{{code}}</html>'
 * ); // Throws: Missing required parameters: link, expiryMinutes
 * ```
 */
export function validateTemplateParams(templateType: TemplateType | string, templateContent: string): void {
  // Get required params for this template type
  const requiredParams = TEMPLATE_REQUIRED_PARAMS[templateType as TemplateType] || [];

  if (requiredParams.length === 0) {
    // No validation needed for templates with no required params
    return;
  }

  // Extract all Handlebars variables from template
  // Matches: {{variable}}, {{#if variable}}, {{#each variable}}, etc.
  const variablePattern = /\{\{[#/]?(\w+)(?:\s|}})/g;
  const foundVariables = new Set<string>();

  let match;
  while ((match = variablePattern.exec(templateContent)) !== null) {
    foundVariables.add(match[1]);
  }

  // Check for missing required parameters
  const missingParams = requiredParams.filter((param) => !foundVariables.has(param));

  if (missingParams.length > 0) {
    throw new NAuthException(
      AuthErrorCode.INTERNAL_ERROR,
      `Invalid template configuration for "${templateType}": ` +
        `Missing required parameters: ${missingParams.join(', ')}. ` +
        `Template must include: ${requiredParams.map((p) => `{{${p}}}`).join(', ')}`,
    );
  }
}

/**
 * Validate custom template definition
 *
 * Ensures template definition is valid:
 * - Has either htmlPath OR html content
 * - Contains all required parameters for template type
 *
 * @param templateType - Type of template being validated
 * @param definition - Template definition to validate
 * @param templateContent - Already loaded template content (if available)
 * @throws {NAuthException} If template definition is invalid
 *
 * @example
 * ```typescript
 * validateCustomTemplate(TemplateType.VERIFICATION, {
 *   htmlPath: './verification.html.hbs'
 * });
 * ```
 */
export function validateCustomTemplate(
  templateType: TemplateType | string,
  definition: CustomTemplateDefinition,
  templateContent?: string,
): void {
  // Validate that either htmlPath or html is provided
  if (!definition.htmlPath && !definition.html) {
    throw new NAuthException(
      AuthErrorCode.INTERNAL_ERROR,
      `Invalid template configuration for "${templateType}": ` + `Must provide either "htmlPath" or "html" content.`,
    );
  }

  // Validate that both htmlPath and html are not provided
  if (definition.htmlPath && definition.html) {
    throw new NAuthException(
      AuthErrorCode.INTERNAL_ERROR,
      `Invalid template configuration for "${templateType}": ` +
        `Cannot provide both "htmlPath" and "html". Use one or the other.`,
    );
  }

  // Validate that both textPath and text are not provided
  if (definition.textPath && definition.text) {
    throw new NAuthException(
      AuthErrorCode.INTERNAL_ERROR,
      `Invalid template configuration for "${templateType}": ` +
        `Cannot provide both "textPath" and "text". Use one or the other.`,
    );
  }

  // If template content is provided, validate parameters
  if (templateContent) {
    validateTemplateParams(templateType, templateContent);
  }
}

/**
 * Get help text for template parameters
 *
 * Returns human-readable list of required and optional parameters
 * for a specific template type.
 *
 * @param templateType - Template type
 * @returns Help text with parameter information
 *
 * @example
 * ```typescript
 * console.log(getTemplateParamsHelp(TemplateType.VERIFICATION));
 * // Output:
 * // Required parameters:
 * //   - {{code}}: Verification code
 * //   - {{link}}: Verification link
 * //   - {{expiryMinutes}}: Code expiry time
 * // Optional parameters:
 * //   - {{firstName}}, {{lastName}}, {{userName}}, {{appName}}, etc.
 * ```
 */
export function getTemplateParamsHelp(templateType: TemplateType): string {
  const required = TEMPLATE_REQUIRED_PARAMS[templateType];

  let help = `Template: ${templateType}\n\n`;

  if (required.length > 0) {
    help += `Required parameters (must be in template):\n`;
    required.forEach((param) => {
      help += `  - {{${param}}}\n`;
    });
  } else {
    help += `No required parameters.\n`;
  }

  help += `\nOptional parameters (available at runtime):\n`;
  help += `  - User: {{firstName}}, {{lastName}}, {{userName}}, {{greetingName}}\n`;
  help += `  - Branding: {{appName}}, {{companyName}}, {{brandColor}}, {{logoUrl}}\n`;
  help += `  - Support: {{supportEmail}}, {{dashboardUrl}}\n`;
  help += `  - Social: {{facebookUrl}}, {{twitterUrl}}, {{linkedinUrl}}\n`;
  help += `  - Other: {{currentYear}}\n`;

  return help;
}
