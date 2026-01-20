import {
  TemplateEngine,
  TemplateType,
  TemplateVariables,
  EmailTemplate,
  NAuthException,
  AuthErrorCode,
} from '@nauth-toolkit/core';
import * as Handlebars from 'handlebars';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Template Source
 *
 * Defines how template content can be provided - as a string or file path
 */
export interface TemplateSource {
  /**
   * Template content as a string
   */
  content?: string;

  /**
   * Path to template file (relative or absolute)
   * Supports .hbs, .html, .txt, etc.
   */
  filePath?: string;
}

/**
 * Template Files Configuration
 *
 * Defines template sources for subject, HTML, and text content.
 * Supports both inline content and file paths.
 */
export interface TemplateFiles {
  /**
   * Subject line template source
   */
  subject: TemplateSource;

  /**
   * HTML content template source
   */
  html: TemplateSource;

  /**
   * Plain text content template source (optional)
   */
  text?: TemplateSource;
}

/**
 * Handlebars Template Engine Options
 */
export interface HandlebarsTemplateEngineOptions {
  /**
   * Base directory for resolving relative template paths
   * @default process.cwd()
   */
  baseDir?: string;

  /**
   * Whether to load built-in default templates
   * @default true
   */
  useDefaultTemplates?: boolean;

  /**
   * Custom Handlebars helpers
   */
  helpers?: Record<string, Handlebars.HelperDelegate>;

  /**
   * Handlebars partials (in-memory)
   *
   * Keys are the partial names (used like `{{> footer }}`), values are the partial templates.
   *
   * @example
   * ```typescript
   * const engine = new HandlebarsTemplateEngine({
   *   partials: {
   *     footer: '<footer>&copy; {{currentYear}} {{companyName}}</footer>',
   *   },
   * });
   * ```
   */
  partials?: Record<string, string>;

  /**
   * Directory containing `.hbs` partials
   *
   * Files are registered by filename (without extension).
   * Example: `partials/footer.hbs` → `{{> footer }}`
   *
   * @example
   * ```typescript
   * const engine = new HandlebarsTemplateEngine({
   *   baseDir: process.cwd(),
   *   partialsDir: './email-templates/partials',
   * });
   * ```
   */
  partialsDir?: string;

  /**
   * Handlebars compile options
   */
  compileOptions?: CompileOptions;
}

/**
 * Handlebars Template Engine
 *
 * Powerful template engine using Handlebars.js for email templates.
 * Supports:
 * - File-based templates (.hbs files)
 * - Inline string templates
 * - Full Handlebars syntax (if/each/unless/with, etc.)
 * - Custom helpers
 * - Partials support
 * - Built-in default templates
 *
 * Consumer apps can easily customize templates by:
 * 1. Providing custom .hbs files
 * 2. Providing HTML/text as strings
 * 3. Using Handlebars helpers for complex logic
 *
 * @example
 * ```typescript
 * // Using default templates
 * const engine = new HandlebarsTemplateEngine();
 *
 * // Using custom templates from files
 * const engine = new HandlebarsTemplateEngine({
 *   baseDir: './my-templates',
 *   useDefaultTemplates: false
 * });
 *
 * await engine.registerTemplateFromSources(TemplateType.WELCOME, {
 *   subject: { filePath: 'welcome.subject.hbs' },
 *   html: { filePath: 'welcome.html.hbs' },
 *   text: { filePath: 'welcome.text.hbs' }
 * });
 *
 * // Using inline templates
 * engine.registerTemplate(TemplateType.CUSTOM, {
 *   subject: 'Hello {{name}}',
 *   html: '<h1>Hello {{name}}</h1>',
 *   text: 'Hello {{name}}'
 * });
 * ```
 */
export class HandlebarsTemplateEngine implements TemplateEngine {
  /**
   * Storage for compiled templates
   * Maps template type to compiled Handlebars functions
   */
  private templates: Map<
    string,
    {
      subject: Handlebars.TemplateDelegate;
      html: Handlebars.TemplateDelegate;
      text?: Handlebars.TemplateDelegate;
    }
  > = new Map();

  /**
   * Handlebars instance
   */
  private readonly handlebars: typeof Handlebars;

  /**
   * Base directory for template files
   */
  private readonly baseDir: string;

  /**
   * Constructor
   *
   * @param options - Template engine configuration options
   */
  constructor(options: HandlebarsTemplateEngineOptions = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.handlebars = Handlebars.create();

    // Register custom helpers
    this.registerDefaultHelpers();
    if (options.helpers) {
      Object.entries(options.helpers).forEach(([name, helper]) => {
        this.handlebars.registerHelper(name, helper);
      });
    }

    // Register partials (optional)
    if (options.partials) {
      Object.entries(options.partials).forEach(([name, content]) => {
        this.handlebars.registerPartial(name, content);
      });
    }
    if (options.partialsDir) {
      this.registerPartialsFromDir(options.partialsDir);
    }

    // Load default templates if enabled
    if (options.useDefaultTemplates !== false) {
      this.registerDefaultTemplates();
    }
  }

  /**
   * Render a template with variables
   *
   * @param type - Template type to render
   * @param variables - Variables to inject
   * @returns Rendered email template
   * @throws {NAuthException} If template type not found
   */
  async render(type: TemplateType | string, variables: TemplateVariables): Promise<EmailTemplate> {
    const template = this.templates.get(type);

    if (!template) {
      throw new NAuthException(
        AuthErrorCode.INTERNAL_ERROR,
        `Template "${type}" not found. Available templates: ${Array.from(this.templates.keys()).join(', ')}`,
      );
    }

    // Merge with default variables
    const allVariables: TemplateVariables = {
      currentYear: new Date().getFullYear(),
      ...variables,
    };

    // Render subject first, then expose it to HTML/text templates.
    // MJML-built templates use {{subject}} and {{previewText}} in the shared master layout.
    const subject = template.subject(allVariables);
    const previewText =
      typeof allVariables.previewText === 'string' && allVariables.previewText.trim().length > 0
        ? allVariables.previewText
        : subject;

    const variablesWithMeta: TemplateVariables = {
      ...allVariables,
      subject,
      previewText,
    };

    // Render HTML and text (text falls back to HTML->text conversion)
    const html = template.html(variablesWithMeta);
    const text = template.text ? template.text(variablesWithMeta) : this.htmlToText(html);

    return { subject, html, text };
  }

  /**
   * Register a custom template from inline strings
   *
   * @param type - Template type identifier
   * @param template - Template definition with inline content
   */
  registerTemplate(type: TemplateType | string, template: EmailTemplate): void {
    this.templates.set(type, {
      subject: this.handlebars.compile(template.subject),
      html: this.handlebars.compile(template.html),
      text: template.text ? this.handlebars.compile(template.text) : undefined,
    });
  }

  /**
   * Register a custom template from a single file
   *
   * Loads HTML template with frontmatter for subject.
   * Format:
   * ```
   * ---
   * subject: Email Subject {{variable}}
   * ---
   * <html>...</html>
   * ```
   *
   * @param type - Template type identifier
   * @param htmlFilePath - Path to HTML template file (relative to baseDir)
   * @param textFilePath - Optional path to plain text template
   */
  async registerTemplateFromFile(
    type: TemplateType | string,
    htmlFilePath: string,
    textFilePath?: string,
  ): Promise<void> {
    // If path is already absolute, use it directly; otherwise resolve relative to baseDir
    const fullHtmlPath =
      htmlFilePath.startsWith('/') || /^[A-Z]:/.test(htmlFilePath) // Windows absolute path
        ? htmlFilePath
        : resolve(this.baseDir, htmlFilePath);

    try {
      const htmlContent = readFileSync(fullHtmlPath, 'utf-8');
      const { subject, html } = this.parseFrontmatter(htmlContent);

      let text: string | undefined;
      if (textFilePath) {
        // If path is already absolute, use it directly; otherwise resolve relative to baseDir
        const fullTextPath =
          textFilePath.startsWith('/') || /^[A-Z]:/.test(textFilePath) // Windows absolute path
            ? textFilePath
            : resolve(this.baseDir, textFilePath);
        text = readFileSync(fullTextPath, 'utf-8');
      }

      this.templates.set(type, {
        subject: this.handlebars.compile(subject),
        html: this.handlebars.compile(html),
        text: text ? this.handlebars.compile(text) : undefined,
      });
    } catch (error) {
      throw new NAuthException(
        AuthErrorCode.INTERNAL_ERROR,
        `Failed to load template file: ${fullHtmlPath}. Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Register a custom template from mixed sources (strings or files)
   *
   * @param type - Template type identifier
   * @param templateSources - Template sources (content or file paths)
   */
  async registerTemplateFromSources(type: TemplateType | string, templateSources: TemplateFiles): Promise<void> {
    const subject = await this.loadTemplateSource(templateSources.subject);
    const html = await this.loadTemplateSource(templateSources.html);
    const text = templateSources.text ? await this.loadTemplateSource(templateSources.text) : undefined;

    this.templates.set(type, {
      subject: this.handlebars.compile(subject),
      html: this.handlebars.compile(html),
      text: text ? this.handlebars.compile(text) : undefined,
    });
  }

  /**
   * Get all available template types
   *
   * @returns Array of template type identifiers
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Check if a template exists
   *
   * @param type - Template type to check
   * @returns True if template is registered
   */
  hasTemplate(type: TemplateType | string): boolean {
    return this.templates.has(type);
  }

  /**
   * Parse frontmatter from template file
   *
   * Extracts YAML frontmatter (subject) from template HTML.
   * Format:
   * ```
   * ---
   * subject: Email Subject
   * ---
   * HTML content
   * ```
   *
   * @param content - File content
   * @returns Parsed subject and HTML
   * @private
   */
  private parseFrontmatter(content: string): { subject: string; html: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      throw new NAuthException(
        AuthErrorCode.INTERNAL_ERROR,
        'Template file must have frontmatter with subject. Format:\n---\nsubject: Your Subject\n---\n<html>...',
      );
    }

    const frontmatter = match[1];
    const html = match[2];

    // Simple YAML parsing for subject line
    const subjectMatch = frontmatter.match(/subject:\s*(.+)/);
    if (!subjectMatch) {
      throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Template frontmatter must include "subject" field');
    }

    return {
      subject: subjectMatch[1].trim(),
      html: html.trim(),
    };
  }

  /**
   * Load template content from source (file or inline content)
   *
   * @param source - Template source
   * @returns Template content as string
   * @private
   */
  private async loadTemplateSource(source: TemplateSource): Promise<string> {
    if (source.content) {
      return source.content;
    }

    if (source.filePath) {
      // If path is already absolute, use it directly; otherwise resolve relative to baseDir
      const fullPath =
        source.filePath.startsWith('/') || source.filePath.match(/^[A-Z]:/) // Windows absolute path
          ? source.filePath
          : resolve(this.baseDir, source.filePath);
      try {
        return readFileSync(fullPath, 'utf-8');
      } catch (error) {
        throw new NAuthException(
          AuthErrorCode.INTERNAL_ERROR,
          `Failed to load template file: ${fullPath}. Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    throw new NAuthException(AuthErrorCode.INTERNAL_ERROR, 'Template source must have either content or filePath');
  }

  /**
   * Convert HTML to plain text
   *
   * Simple conversion: strips HTML tags and decodes entities.
   *
   * @param html - HTML content
   * @returns Plain text
   * @private
   */
  private htmlToText(html: string): string {
    // Strip HTML tags
    let text = html.replace(/<[^>]*>/g, '');

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
  }

  /**
   * Register default Handlebars helpers
   *
   * @private
   */
  private registerDefaultHelpers(): void {
    // Equality helper
    this.handlebars.registerHelper('eq', function (a, b) {
      return a === b;
    });

    // Not equal helper
    this.handlebars.registerHelper('ne', function (a, b) {
      return a !== b;
    });

    // Greater than helper
    this.handlebars.registerHelper('gt', function (a, b) {
      return a > b;
    });

    // Less than helper
    this.handlebars.registerHelper('lt', function (a, b) {
      return a < b;
    });

    // And helper
    this.handlebars.registerHelper('and', function (...args) {
      // Remove Handlebars options object from end
      const values = args.slice(0, -1);
      return values.every((v) => !!v);
    });

    // Or helper
    this.handlebars.registerHelper('or', function (...args) {
      // Remove Handlebars options object from end
      const values = args.slice(0, -1);
      return values.some((v) => !!v);
    });

    // Format date helper
    this.handlebars.registerHelper('formatDate', function (date) {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString();
    });
  }

  /**
   * Register all `.hbs` partials from a directory
   *
   * @param partialsDir - Directory path (relative to baseDir or absolute)
   * @private
   */
  private registerPartialsFromDir(partialsDir: string): void {
    const fullDir = resolve(this.baseDir, partialsDir);
    const files = readdirSync(fullDir);

    files.forEach((fileName) => {
      if (!fileName.endsWith('.hbs')) return;
      const partialName = fileName.replace(/\.hbs$/, '');
      const fullPath = join(fullDir, fileName);
      const content = readFileSync(fullPath, 'utf-8');
      this.handlebars.registerPartial(partialName, content);
    });
  }

  /**
   * Register default templates from built-in files
   *
   * Loads templates from the default templates directory.
   * @private
   */
  private registerDefaultTemplates(): void {
    const defaultTemplatesDir = join(__dirname, 'default');

    // Template type to file name mapping (using kebab-case for files)
    const templateFileMapping: Record<string, string> = {
      [TemplateType.VERIFICATION]: 'verification',
      [TemplateType.PASSWORD_RESET]: 'password-reset',
      [TemplateType.ADMIN_PASSWORD_RESET]: 'admin-password-reset',
      [TemplateType.WELCOME]: 'welcome',
      [TemplateType.ACCOUNT_LOCKOUT]: 'account-lockout',
      [TemplateType.NEW_DEVICE]: 'new-device',
      [TemplateType.PASSWORD_CHANGED]: 'password-changed',
      [TemplateType.EMAIL_CHANGED]: 'email-changed',
      [TemplateType.MFA_ENABLED]: 'mfa-enabled',
      [TemplateType.MFA_DEVICE_REMOVED]: 'mfa-device-removed',
      [TemplateType.MFA_METHOD_ADDED]: 'mfa-method-added',
      [TemplateType.ADAPTIVE_MFA_RISK_ALERT]: 'adaptive-mfa-risk-alert',
      [TemplateType.ACCOUNT_DISABLED]: 'account-disabled',
      [TemplateType.ACCOUNT_ENABLED]: 'account-enabled',
      [TemplateType.EMAIL_CHANGED_OLD]: 'email-changed-old',
      [TemplateType.EMAIL_CHANGED_NEW]: 'email-changed-new',
      [TemplateType.SESSIONS_REVOKED]: 'sessions-revoked',
      [TemplateType.MFA_EMAIL_CODE]: 'mfa-email-code',
    };

    // Register all default templates
    Object.entries(templateFileMapping).forEach(([templateType, fileName]) => {
      try {
        const htmlPath = join(defaultTemplatesDir, `${fileName}.html.hbs`);
        const textPath = join(defaultTemplatesDir, `${fileName}.text.hbs`);

        const htmlContent = readFileSync(htmlPath, 'utf-8');
        const { subject, html } = this.parseFrontmatter(htmlContent);
        const text = readFileSync(textPath, 'utf-8');

        this.templates.set(templateType, {
          subject: this.handlebars.compile(subject),
          html: this.handlebars.compile(html),
          text: this.handlebars.compile(text),
        });
      } catch (error) {
        // If default templates are missing, just skip them
        // This allows the package to work even if templates are not bundled
        console.warn(`Warning: Could not load default template for ${templateType}:`, error);
      }
    });
  }
}
