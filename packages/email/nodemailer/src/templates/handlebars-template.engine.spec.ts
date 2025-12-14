import { HandlebarsTemplateEngine } from './handlebars-template.engine';
import { TemplateType } from '@nauth-toolkit/core';

describe('HandlebarsTemplateEngine', () => {
  let engine: HandlebarsTemplateEngine;

  beforeEach(() => {
    engine = new HandlebarsTemplateEngine({
      useDefaultTemplates: false, // Don't load files in tests
    });
  });

  describe('registerTemplate', () => {
    it('should register and render a simple template', async () => {
      engine.registerTemplate(TemplateType.WELCOME, {
        subject: 'Welcome {{userName}}',
        html: '<h1>Hello {{userName}}</h1>',
        text: 'Hello {{userName}}',
      });

      const result = await engine.render(TemplateType.WELCOME, {
        userName: 'John Doe',
      });

      expect(result.subject).toBe('Welcome John Doe');
      expect(result.html).toBe('<h1>Hello John Doe</h1>');
      expect(result.text).toBe('Hello John Doe');
    });

    it('should handle greeting name fallback', async () => {
      engine.registerTemplate('test', {
        subject: 'Test',
        html: '<p>{{#if greetingName}}Hi {{greetingName}}{{else}}Hi{{/if}}</p>',
      });

      const result1 = await engine.render('test', {
        firstName: 'John',
        userName: 'johndoe',
      });
      expect(result1.html).toContain('Hi John');

      const result2 = await engine.render('test', {
        userName: 'johndoe',
      });
      expect(result2.html).toContain('Hi johndoe');

      const result3 = await engine.render('test', {});
      expect(result3.html).toContain('<p>Hi</p>');
    });

    it('should add current year automatically', async () => {
      engine.registerTemplate('test', {
        subject: 'Test',
        html: '<p>&copy; {{currentYear}}</p>',
      });

      const result = await engine.render('test', {});
      expect(result.html).toContain(`&copy; ${new Date().getFullYear()}`);
    });

    it('should support Handlebars conditionals', async () => {
      engine.registerTemplate('test', {
        subject: 'Test',
        html: '{{#if isActive}}Active{{else}}Inactive{{/if}}',
      });

      const result1 = await engine.render('test', { isActive: true });
      expect(result1.html).toBe('Active');

      const result2 = await engine.render('test', { isActive: false });
      expect(result2.html).toBe('Inactive');
    });

    it('should support Handlebars loops', async () => {
      engine.registerTemplate('test', {
        subject: 'Test',
        html: '<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>',
      });

      const result = await engine.render('test', {
        items: ['Item 1', 'Item 2', 'Item 3'],
      });

      expect(result.html).toContain('<li>Item 1</li>');
      expect(result.html).toContain('<li>Item 2</li>');
      expect(result.html).toContain('<li>Item 3</li>');
    });

    it('should support custom helpers', async () => {
      const engineWithHelpers = new HandlebarsTemplateEngine({
        useDefaultTemplates: false,
        helpers: {
          uppercase: (str: string) => str.toUpperCase(),
        },
      });

      engineWithHelpers.registerTemplate('test', {
        subject: '{{uppercase appName}}',
        html: '<h1>{{uppercase appName}}</h1>',
      });

      const result = await engineWithHelpers.render('test', {
        appName: 'my app',
      });

      expect(result.subject).toBe('MY APP');
      expect(result.html).toBe('<h1>MY APP</h1>');
    });
  });

  describe('registerTemplateFromSources', () => {
    it('should register template from inline content', async () => {
      await engine.registerTemplateFromSources(TemplateType.WELCOME, {
        subject: { content: 'Welcome {{userName}}' },
        html: { content: '<h1>Hello {{userName}}</h1>' },
        text: { content: 'Hello {{userName}}' },
      });

      const result = await engine.render(TemplateType.WELCOME, {
        userName: 'Jane Doe',
      });

      expect(result.subject).toBe('Welcome Jane Doe');
      expect(result.html).toBe('<h1>Hello Jane Doe</h1>');
      expect(result.text).toBe('Hello Jane Doe');
    });
  });

  describe('hasTemplate', () => {
    it('should return true for registered templates', () => {
      engine.registerTemplate('test', {
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(engine.hasTemplate('test')).toBe(true);
      expect(engine.hasTemplate('nonexistent')).toBe(false);
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return list of registered templates', () => {
      engine.registerTemplate('test1', {
        subject: 'Test',
        html: '<p>Test</p>',
      });

      engine.registerTemplate('test2', {
        subject: 'Test',
        html: '<p>Test</p>',
      });

      const templates = engine.getAvailableTemplates();
      expect(templates).toContain('test1');
      expect(templates).toContain('test2');
      expect(templates).toHaveLength(2);
    });
  });

  describe('built-in helpers', () => {
    beforeEach(() => {
      engine = new HandlebarsTemplateEngine({
        useDefaultTemplates: false,
      });
    });

    it('should support eq helper', async () => {
      engine.registerTemplate('test', {
        subject: 'Test',
        html: '{{#if (eq status "active")}}Active{{else}}Other{{/if}}',
      });

      const result = await engine.render('test', { status: 'active' });
      expect(result.html).toBe('Active');
    });

    it('should support and helper', async () => {
      engine.registerTemplate('test', {
        subject: 'Test',
        html: '{{#if (and isActive isVerified)}}Yes{{else}}No{{/if}}',
      });

      const result1 = await engine.render('test', {
        isActive: true,
        isVerified: true,
      });
      expect(result1.html).toBe('Yes');

      const result2 = await engine.render('test', {
        isActive: true,
        isVerified: false,
      });
      expect(result2.html).toBe('No');
    });

    it('should support or helper', async () => {
      engine.registerTemplate('test', {
        subject: 'Test',
        html: '{{#if (or isAdmin isModerator)}}Yes{{else}}No{{/if}}',
      });

      const result1 = await engine.render('test', {
        isAdmin: true,
        isModerator: false,
      });
      expect(result1.html).toBe('Yes');

      const result2 = await engine.render('test', {
        isAdmin: false,
        isModerator: false,
      });
      expect(result2.html).toBe('No');
    });
  });

  describe('error handling', () => {
    it('should throw error when template not found', async () => {
      await expect(engine.render('nonexistent', {})).rejects.toThrow(/Template "nonexistent" not found/);
    });

    it('should throw error when source has neither content nor filePath', async () => {
      await expect(
        engine.registerTemplateFromSources('test', {
          subject: {} as any, // Invalid source
          html: { content: '<p>Test</p>' },
        }),
      ).rejects.toThrow(/Template source must have either content or filePath/);
    });
  });

  describe('HTML to text conversion', () => {
    it('should generate plain text from HTML when text template is not provided', async () => {
      engine.registerTemplate('test', {
        subject: 'Test',
        html: '<h1>Hello</h1><p>World</p>',
        // No text template provided
      });

      const result = await engine.render('test', {});
      expect(result.text).toBeTruthy();
      expect(result.text).toContain('Hello');
      expect(result.text).toContain('World');
      // Should strip HTML tags
      expect(result.text).not.toContain('<h1>');
      expect(result.text).not.toContain('<p>');
    });
  });
});
