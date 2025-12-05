"use strict";
/**
 * Template Validation Utility
 *
 * Validates custom templates to ensure they include all required parameters.
 * Provides clear error messages for missing parameters.
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMPLATE_OPTIONAL_PARAMS = exports.TEMPLATE_REQUIRED_PARAMS = void 0;
exports.validateTemplateParams = validateTemplateParams;
exports.validateCustomTemplate = validateCustomTemplate;
exports.getTemplateParamsHelp = getTemplateParamsHelp;
var template_interface_1 = require("../interfaces/template.interface");
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
/**
 * Required parameters for each template type
 *
 * Maps template types to their required Handlebars variables.
 */
exports.TEMPLATE_REQUIRED_PARAMS = (_a = {},
    _a[template_interface_1.TemplateType.VERIFICATION] = ['code', 'link', 'expiryMinutes'],
    _a[template_interface_1.TemplateType.PASSWORD_RESET] = ['link', 'expiryMinutes'],
    _a[template_interface_1.TemplateType.WELCOME] = [],
    _a[template_interface_1.TemplateType.ACCOUNT_LOCKOUT] = ['reason', 'durationMinutes'],
    _a[template_interface_1.TemplateType.NEW_DEVICE] = ['deviceName', 'timestamp'],
    _a[template_interface_1.TemplateType.PASSWORD_CHANGED] = [],
    _a[template_interface_1.TemplateType.EMAIL_CHANGED] = ['userEmail'],
    _a[template_interface_1.TemplateType.MFA_ENABLED] = [],
    _a);
/**
 * Optional parameters available to all templates
 *
 * These can be used but are not required.
 * Injected by the template engine at runtime if available.
 */
exports.TEMPLATE_OPTIONAL_PARAMS = [
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
function validateTemplateParams(templateType, templateContent) {
    // Get required params for this template type
    var requiredParams = exports.TEMPLATE_REQUIRED_PARAMS[templateType] || [];
    if (requiredParams.length === 0) {
        // No validation needed for templates with no required params
        return;
    }
    // Extract all Handlebars variables from template
    // Matches: {{variable}}, {{#if variable}}, {{#each variable}}, etc.
    var variablePattern = /\{\{[#/]?(\w+)(?:\s|}})/g;
    var foundVariables = new Set();
    var match;
    while ((match = variablePattern.exec(templateContent)) !== null) {
        foundVariables.add(match[1]);
    }
    // Check for missing required parameters
    var missingParams = requiredParams.filter(function (param) { return !foundVariables.has(param); });
    if (missingParams.length > 0) {
        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, "Invalid template configuration for \"".concat(templateType, "\": ") +
            "Missing required parameters: ".concat(missingParams.join(', '), ". ") +
            "Template must include: ".concat(requiredParams.map(function (p) { return "{{".concat(p, "}}"); }).join(', ')));
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
function validateCustomTemplate(templateType, definition, templateContent) {
    // Validate that either htmlPath or html is provided
    if (!definition.htmlPath && !definition.html) {
        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, "Invalid template configuration for \"".concat(templateType, "\": ") + "Must provide either \"htmlPath\" or \"html\" content.");
    }
    // Validate that both htmlPath and html are not provided
    if (definition.htmlPath && definition.html) {
        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, "Invalid template configuration for \"".concat(templateType, "\": ") +
            "Cannot provide both \"htmlPath\" and \"html\". Use one or the other.");
    }
    // Validate that both textPath and text are not provided
    if (definition.textPath && definition.text) {
        throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, "Invalid template configuration for \"".concat(templateType, "\": ") +
            "Cannot provide both \"textPath\" and \"text\". Use one or the other.");
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
function getTemplateParamsHelp(templateType) {
    var required = exports.TEMPLATE_REQUIRED_PARAMS[templateType];
    var help = "Template: ".concat(templateType, "\n\n");
    if (required.length > 0) {
        help += "Required parameters (must be in template):\n";
        required.forEach(function (param) {
            help += "  - {{".concat(param, "}}\n");
        });
    }
    else {
        help += "No required parameters.\n";
    }
    help += "\nOptional parameters (available at runtime):\n";
    help += "  - User: {{firstName}}, {{lastName}}, {{userName}}, {{greetingName}}\n";
    help += "  - Branding: {{appName}}, {{companyName}}, {{brandColor}}, {{logoUrl}}\n";
    help += "  - Support: {{supportEmail}}, {{dashboardUrl}}\n";
    help += "  - Social: {{facebookUrl}}, {{twitterUrl}}, {{linkedinUrl}}\n";
    help += "  - Other: {{currentYear}}\n";
    return help;
}
