"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlTemplateEngine = void 0;
var template_interface_1 = require("../interfaces/template.interface");
var nauth_exception_1 = require("../exceptions/nauth.exception");
var error_codes_enum_1 = require("../enums/error-codes.enum");
/**
 * HTML Template Engine
 *
 * Simple yet powerful template engine for email templates using HTML with placeholder tokens.
 * Supports {{variable}} syntax for variable injection.
 *
 * Features:
 * - Simple {{variable}} placeholder syntax
 * - Built-in default templates for all email types
 * - Custom template registration
 * - Automatic HTML entity escaping for security
 * - Plain text generation from HTML
 *
 * @example
 * ```typescript
 * const engine = new HtmlTemplateEngine();
 * const result = await engine.render(
 *   TemplateType.VERIFICATION,
 *   { userName: 'John', code: '123456', expiryMinutes: 60 }
 * );
 * ```
 */
var HtmlTemplateEngine = /** @class */ (function () {
    /**
     * Constructor
     * Initializes the engine with default templates
     */
    function HtmlTemplateEngine() {
        /**
         * Storage for registered templates
         * Maps template type to template definition
         */
        this.templates = new Map();
        this.registerDefaultTemplates();
    }
    /**
     * Render a template with variables
     *
     * Replaces all {{variable}} placeholders with actual values.
     * Variables are HTML-escaped for security.
     * Handles firstName/username fallback for greetings.
     *
     * @param type - Template type to render
     * @param variables - Variables to inject
     * @returns Rendered email template
     * @throws {Error} If template type not found
     */
    HtmlTemplateEngine.prototype.render = function (type, variables) {
        return __awaiter(this, void 0, void 0, function () {
            var template, allVariables, subject, html, text;
            return __generator(this, function (_a) {
                template = this.templates.get(type);
                if (!template) {
                    throw new nauth_exception_1.NAuthException(error_codes_enum_1.AuthErrorCode.INTERNAL_ERROR, "Template \"".concat(type, "\" not found. Available templates: ").concat(Array.from(this.templates.keys()).join(', ')));
                }
                allVariables = __assign(__assign({ currentYear: new Date().getFullYear() }, variables), { greetingName: this.getGreetingName(variables) });
                subject = this.replaceVariables(template.subject, allVariables);
                html = this.replaceVariables(template.html, allVariables);
                text = template.text ? this.replaceVariablesForText(template.text, allVariables) : this.htmlToText(html);
                return [2 /*return*/, { subject: subject, html: html, text: text }];
            });
        });
    };
    /**
     * Register a custom template
     *
     * @param type - Template type identifier
     * @param template - Template definition
     */
    HtmlTemplateEngine.prototype.registerTemplate = function (type, template) {
        this.templates.set(type, template);
    };
    /**
     * Get all available template types
     *
     * @returns Array of template type identifiers
     */
    HtmlTemplateEngine.prototype.getAvailableTemplates = function () {
        return Array.from(this.templates.keys());
    };
    /**
     * Check if a template exists
     *
     * @param type - Template type to check
     * @returns True if template is registered
     */
    HtmlTemplateEngine.prototype.hasTemplate = function (type) {
        return this.templates.has(type);
    };
    /**
     * Replace {{variable}} placeholders with values
     *
     * Escapes HTML entities in variables for security.
     * Handles missing variables gracefully (replaces with empty string).
     * Supports firstName/username fallback logic and simple conditionals.
     *
     * @param template - Template string with {{placeholders}}
     * @param variables - Variables to inject
     * @returns Template with variables replaced
     * @private
     */
    HtmlTemplateEngine.prototype.replaceVariables = function (template, variables) {
        var _this = this;
        var result = template;
        // Handle simple conditionals like {{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}
        result = result.replace(/\{\{#if (\w+)\}\}(.*?)\{\{else\}\}(.*?)\{\{\/if\}\}/g, function (_match, key, ifContent, elseContent) {
            var value = variables[key];
            if (value && value !== '') {
                return ifContent;
            }
            else {
                return elseContent;
            }
        });
        // Replace regular variables
        result = result.replace(/\{\{(\w+)\}\}/g, function (_match, key) {
            var value = variables[key];
            // Return empty string if variable is undefined
            if (value === undefined || value === null) {
                return '';
            }
            // Convert to string and escape HTML entities
            return _this.escapeHtml(String(value));
        });
        return result;
    };
    /**
     * Replace {{variable}} placeholders with values for text content
     *
     * Similar to replaceVariables but doesn't escape HTML entities for plain text.
     *
     * @param template - Template string with {{placeholders}}
     * @param variables - Variables to inject
     * @returns Template with variables replaced
     * @private
     */
    HtmlTemplateEngine.prototype.replaceVariablesForText = function (template, variables) {
        var result = template;
        // Handle simple conditionals like {{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}
        result = result.replace(/\{\{#if (\w+)\}\}(.*?)\{\{else\}\}(.*?)\{\{\/if\}\}/g, function (_match, key, ifContent, elseContent) {
            var value = variables[key];
            if (value && value !== '') {
                return ifContent;
            }
            else {
                return elseContent;
            }
        });
        // Replace regular variables without HTML escaping
        result = result.replace(/\{\{(\w+)\}\}/g, function (_match, key) {
            var value = variables[key];
            // Return empty string if variable is undefined
            if (value === undefined || value === null) {
                return '';
            }
            // Convert to string without escaping HTML entities for text
            return String(value);
        });
        return result;
    };
    /**
     * Get greeting name with firstName/username fallback logic
     *
     * @param variables - Template variables
     * @returns Greeting name or empty string
     * @private
     */
    HtmlTemplateEngine.prototype.getGreetingName = function (variables) {
        if (variables.firstName) {
            return variables.firstName;
        }
        if (variables.userName) {
            return variables.userName;
        }
        return '';
    };
    /**
     * Escape HTML entities to prevent XSS
     *
     * @param text - Text to escape
     * @returns HTML-safe text
     * @private
     */
    HtmlTemplateEngine.prototype.escapeHtml = function (text) {
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return text.replace(/[&<>"']/g, function (char) { return map[char] || char; });
    };
    /**
     * Convert HTML to plain text
     *
     * Simple conversion: strips HTML tags and decodes entities.
     *
     * @param html - HTML content
     * @returns Plain text
     * @private
     */
    HtmlTemplateEngine.prototype.htmlToText = function (html) {
        // Strip HTML tags
        var text = html.replace(/<[^>]*>/g, '');
        // Decode common HTML entities
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        text = text.replace(/&quot;/g, '"');
        text = text.replace(/&#039;/g, "'");
        text = text.replace(/&amp;/g, '&');
        // Normalize whitespace
        text = text.replace(/\s+/g, ' ').trim();
        return text;
    };
    /**
     * Register default templates for all email types
     *
     * These templates can be overridden using registerTemplate().
     * @private
     */
    HtmlTemplateEngine.prototype.registerDefaultTemplates = function () {
        // ============================================================================
        // Email Verification Template
        // ============================================================================
        this.registerTemplate(template_interface_1.TemplateType.VERIFICATION, {
            subject: 'Email Verification - {{appName}}',
            html: "\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Email Verification</title>\n  <style>\n    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }\n    .container { max-width: 600px; margin: 0 auto; }\n    h1 { font-size: 24px; margin: 0 0 20px 0; }\n    p { margin: 0 0 15px 0; }\n    .code { font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 20px 0; }\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <h1>Email Verification</h1>\n    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>\n    <p>Thank you for signing up! Please verify your email address to activate your account.</p>\n\n    <p>Your Verification Code:</p>\n    <div class=\"code\">{{code}}</div>\n\n    <p>Or click the link below to verify:</p>\n    <p><a href=\"{{link}}\">Verify Email Address</a></p>\n\n    <p>This code expires in {{expiryMinutes}} minutes.</p>\n    <p>If you didn't request this verification, please ignore this email.</p>\n  </div>\n</body>\n</html>\n      ",
            text: "\nEmail Verification\n\n{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}\n\nThank you for signing up! Please verify your email address to activate your account.\n\nYour Verification Code: {{code}}\n\nOr use this link: {{link}}\n\nThis code expires in {{expiryMinutes}} minutes.\n\nIf you didn't request this verification, please ignore this email.\n      ",
        });
        // ============================================================================
        // Password Reset Template
        // ============================================================================
        this.registerTemplate(template_interface_1.TemplateType.PASSWORD_RESET, {
            subject: 'Password Reset - {{appName}}',
            html: "\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Password Reset</title>\n  <style>\n    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }\n    .container { max-width: 600px; margin: 0 auto; }\n    h1 { font-size: 24px; margin: 0 0 20px 0; }\n    p { margin: 0 0 15px 0; }\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <h1>Password Reset</h1>\n    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>\n    <p>We received a request to reset your password. Click the link below to create a new password:</p>\n\n    <p><a href=\"{{link}}\">Reset Your Password</a></p>\n\n    <p>This link expires in {{expiryMinutes}} minutes.</p>\n    <p>If you didn't request a password reset, your account is secure and you can ignore this email.</p>\n\n    <p>If the link doesn't work, copy and paste this URL into your browser:</p>\n    <p>{{link}}</p>\n  </div>\n</body>\n</html>\n      ",
            text: "\nPassword Reset\n\n{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}\n\nWe received a request to reset your password. Use the link below to create a new password:\n\n{{link}}\n\nThis link expires in {{expiryMinutes}} minutes.\n\nIf you didn't request a password reset, your account is secure and you can ignore this email.\n      ",
        });
        // ============================================================================
        // Welcome Email Template
        // ============================================================================
        this.registerTemplate(template_interface_1.TemplateType.WELCOME, {
            subject: 'Welcome to {{appName}}!',
            html: "\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Welcome</title>\n  <style>\n    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }\n    .container { max-width: 600px; margin: 0 auto; }\n    h1 { font-size: 24px; margin: 0 0 20px 0; }\n    p { margin: 0 0 15px 0; }\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <h1>Welcome</h1>\n    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>\n    <p>We're excited to have you with us! Your account has been successfully created and you're ready to get started.</p>\n\n    <p><a href=\"{{dashboardUrl}}\">Get Started</a></p>\n\n    <p>If you have any questions or need assistance, feel free to reach out to our support team at {{supportEmail}}.</p>\n\n    <p>Happy exploring!</p>\n  </div>\n</body>\n</html>\n      ",
            text: "\nWelcome to {{appName}}!\n\n{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}\n\nWe're excited to have you with us! Your account has been successfully created and you're ready to get started.\n\nVisit: {{dashboardUrl}}\n\nIf you have any questions or need assistance, reach out to our support team at {{supportEmail}}.\n\nHappy exploring!\n      ",
        });
        // ============================================================================
        // Account Lockout Template
        // ============================================================================
        this.registerTemplate(template_interface_1.TemplateType.ACCOUNT_LOCKOUT, {
            subject: 'Account Locked - {{appName}}',
            html: "\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Account Lockout</title>\n  <style>\n    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }\n    .container { max-width: 600px; margin: 0 auto; }\n    h1 { font-size: 24px; margin: 0 0 20px 0; }\n    p { margin: 0 0 15px 0; }\n    ul { margin: 0 0 15px 0; }\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <h1>Account Locked</h1>\n    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>\n    <p>Your account has been temporarily locked for security reasons.</p>\n\n    <p><strong>Reason:</strong> {{reason}}</p>\n    <p><strong>Duration:</strong> Your account will be automatically unlocked in {{durationMinutes}} minutes.</p>\n\n    <p><strong>What happened?</strong></p>\n    <p>We detected multiple failed login attempts or suspicious activity on your account. As a security measure, we've temporarily locked your account to protect it.</p>\n\n    <p><strong>What should I do?</strong></p>\n    <ul>\n      <li>Wait {{durationMinutes}} minutes for automatic unlock</li>\n      <li>If this was you, try logging in again after the lockout period</li>\n      <li>If this wasn't you, please contact support immediately at {{supportEmail}}</li>\n      <li>Consider changing your password after unlock</li>\n    </ul>\n  </div>\n</body>\n</html>\n      ",
            text: "\nAccount Locked\n\n{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}\n\nYour account has been temporarily locked for security reasons.\n\nReason: {{reason}}\nDuration: Your account will be automatically unlocked in {{durationMinutes}} minutes.\n\nWhat happened?\nWe detected multiple failed login attempts or suspicious activity on your account.\n\nWhat should I do?\n- Wait {{durationMinutes}} minutes for automatic unlock\n- If this was you, try logging in again after the lockout period\n- If this wasn't you, contact support at {{supportEmail}}\n- Consider changing your password after unlock\n      ",
        });
        // ============================================================================
        // New Device Login Template
        // ============================================================================
        this.registerTemplate(template_interface_1.TemplateType.NEW_DEVICE, {
            subject: 'New Device Login - {{appName}}',
            html: "\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>New Device Login</title>\n  <style>\n    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }\n    .container { max-width: 600px; margin: 0 auto; }\n    h1 { font-size: 24px; margin: 0 0 20px 0; }\n    p { margin: 0 0 15px 0; }\n    ul { margin: 0 0 15px 0; }\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <h1>New Device Login</h1>\n    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>\n    <p>We detected a login to your account from a new device.</p>\n\n    <p><strong>Device:</strong> {{deviceName}}</p>\n    <p><strong>Type:</strong> {{deviceType}}</p>\n    <p><strong>IP Address:</strong> {{ipAddress}}</p>\n    <p><strong>Location:</strong> {{location}}</p>\n    <p><strong>Time:</strong> {{timestamp}}</p>\n\n    <p><strong>Was this you?</strong></p>\n    <p>If you recognize this login, no action is needed. Your account is secure.</p>\n\n    <p><strong>Not you?</strong></p>\n    <p>If you don't recognize this activity, please secure your account immediately:</p>\n    <ul>\n      <li>Change your password</li>\n      <li>Review your recent account activity</li>\n      <li>Contact support at {{supportEmail}}</li>\n    </ul>\n  </div>\n</body>\n</html>\n      ",
            text: "\nNew Device Login\n\n{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}\n\nWe detected a login to your account from a new device.\n\nDevice: {{deviceName}}\nType: {{deviceType}}\nIP Address: {{ipAddress}}\nLocation: {{location}}\nTime: {{timestamp}}\n\nWas this you?\nIf you recognize this login, no action is needed.\n\nNot you?\nIf you don't recognize this activity, secure your account immediately:\n- Change your password\n- Review your recent account activity\n- Contact support at {{supportEmail}}\n      ",
        });
        // Password Changed Template
        // ============================================================================
        this.registerTemplate(template_interface_1.TemplateType.PASSWORD_CHANGED, {
            subject: 'Password Changed - {{appName}}',
            html: "\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Password Changed</title>\n  <style>\n    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }\n    .container { max-width: 600px; margin: 0 auto; }\n    h1 { font-size: 24px; margin: 0 0 20px 0; }\n    p { margin: 0 0 15px 0; }\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <h1>Password Changed</h1>\n    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>\n    <p>Your password has been successfully changed.</p>\n\n    <p>If you made this change, no further action is required.</p>\n\n    <p>If you didn't make this change, please contact support immediately at {{supportEmail}}.</p>\n  </div>\n</body>\n</html>\n      ",
            text: "\nPassword Changed\n\n{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}\n\nYour password has been successfully changed.\n\nIf you made this change, no further action is required.\n\nIf you didn't make this change, please contact support immediately at {{supportEmail}}.\n      ",
        });
        // ============================================================================
        // Email Changed Template
        // ============================================================================
        this.registerTemplate(template_interface_1.TemplateType.EMAIL_CHANGED, {
            subject: 'Email Address Changed - {{appName}}',
            html: "\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Email Changed</title>\n  <style>\n    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }\n    .container { max-width: 600px; margin: 0 auto; }\n    h1 { font-size: 24px; margin: 0 0 20px 0; }\n    p { margin: 0 0 15px 0; }\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <h1>Email Address Changed</h1>\n    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>\n    <p>Your email address has been successfully changed to {{userEmail}}.</p>\n\n    <p>If you made this change, no further action is required.</p>\n\n    <p>If you didn't make this change, please contact support immediately at {{supportEmail}}.</p>\n  </div>\n</body>\n</html>\n      ",
            text: "\nEmail Address Changed\n\n{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}\n\nYour email address has been successfully changed to {{userEmail}}.\n\nIf you made this change, no further action is required.\n\nIf you didn't make this change, please contact support immediately at {{supportEmail}}.\n      ",
        });
        // ============================================================================
        // MFA Enabled Template
        // ============================================================================
        this.registerTemplate(template_interface_1.TemplateType.MFA_ENABLED, {
            subject: 'Two-Factor Authentication Enabled - {{appName}}',
            html: "\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>MFA Enabled</title>\n  <style>\n    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }\n    .container { max-width: 600px; margin: 0 auto; }\n    h1 { font-size: 24px; margin: 0 0 20px 0; }\n    p { margin: 0 0 15px 0; }\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <h1>Two-Factor Authentication Enabled</h1>\n    <p>{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}</p>\n    <p>Two-factor authentication has been successfully enabled for your account.</p>\n\n    <p>Your account is now more secure. You'll need to provide both your password and a verification code when logging in.</p>\n\n    <p>If you didn't enable this feature, please contact support immediately at {{supportEmail}}.</p>\n  </div>\n</body>\n</html>\n      ",
            text: "\nTwo-Factor Authentication Enabled\n\n{{#if greetingName}}Hi {{greetingName}},{{else}}Hi,{{/if}}\n\nTwo-factor authentication has been successfully enabled for your account.\n\nYour account is now more secure. You'll need to provide both your password and a verification code when logging in.\n\nIf you didn't enable this feature, please contact support immediately at {{supportEmail}}.\n      ",
        });
    };
    return HtmlTemplateEngine;
}());
exports.HtmlTemplateEngine = HtmlTemplateEngine;
