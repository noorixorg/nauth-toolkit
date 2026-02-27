import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RecaptchaService, RecaptchaServiceConfig, RECAPTCHA_CONFIG } from './recaptcha.service';

describe('RecaptchaService', () => {
  let service: RecaptchaService;
  let mockWindow: {
    grecaptcha?: {
      execute?: jest.Mock;
      enterprise?: { execute?: jest.Mock };
      render?: jest.Mock;
      getResponse?: jest.Mock;
      reset?: jest.Mock;
    };
    Capacitor?: {
      isNativePlatform?: jest.Mock;
    };
  };

  const mockConfig: RecaptchaServiceConfig = {
    enabled: true,
    version: 'v3',
    siteKey: 'test-site-key',
    action: 'test',
    autoLoadScript: true,
  };

  beforeEach(() => {
    // Mock window object
    mockWindow = {};
    (global as Record<string, unknown>).window = mockWindow;

    // Mock document
    const mockDocument = {
      head: {
        appendChild: jest.fn(),
      },
      createElement: jest.fn().mockReturnValue({
        src: '',
        async: false,
        defer: false,
        onload: null,
        onerror: null,
      }),
    };
    (global as Record<string, unknown>).document = mockDocument;
  });

  afterEach(() => {
    delete (global as Record<string, unknown>).window;
    delete (global as Record<string, unknown>).document;
    jest.clearAllMocks();
  });

  describe('Platform Detection', () => {
    it('should detect web platform in browser', () => {
      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: RECAPTCHA_CONFIG, useValue: mockConfig },
        ],
      });
      service = TestBed.inject(RecaptchaService);

      expect(service.getPlatform()).toBe('web');
      expect(service.shouldSkip()).toBe(false);
    });

    it('should detect SSR platform', () => {
      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'server' },
          { provide: RECAPTCHA_CONFIG, useValue: mockConfig },
        ],
      });
      service = TestBed.inject(RecaptchaService);

      expect(service.getPlatform()).toBe('ssr');
      expect(service.shouldSkip()).toBe(true);
    });

    it('should detect Capacitor WebView', () => {
      mockWindow.Capacitor = {
        isNativePlatform: jest.fn().mockReturnValue(false),
      };

      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: RECAPTCHA_CONFIG, useValue: mockConfig },
        ],
      });
      service = TestBed.inject(RecaptchaService);

      expect(service.getPlatform()).toBe('capacitor-webview');
      expect(service.shouldSkip()).toBe(false);
    });

    it('should detect Capacitor native', () => {
      mockWindow.Capacitor = {
        isNativePlatform: jest.fn().mockReturnValue(true),
      };

      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: RECAPTCHA_CONFIG, useValue: mockConfig },
        ],
      });
      service = TestBed.inject(RecaptchaService);

      expect(service.getPlatform()).toBe('capacitor-native');
      expect(service.shouldSkip()).toBe(true);
    });
  });

  describe('Script Loading', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: RECAPTCHA_CONFIG, useValue: mockConfig },
        ],
      });
      service = TestBed.inject(RecaptchaService);
    });

    it('should load v3 script with render parameter', async () => {
      const mockScript = {
        src: '',
        async: false,
        defer: false,
        onload: null as (() => void) | null,
        onerror: null,
      };
      (document.createElement as jest.Mock).mockReturnValue(mockScript);

      const loadPromise = service.loadScript();

      // Simulate script load
      if (mockScript.onload) {
        mockScript.onload();
      }

      await loadPromise;

      expect(mockScript.src).toBe('https://www.google.com/recaptcha/api.js?render=test-site-key');
      expect(mockScript.async).toBe(true);
      expect(mockScript.defer).toBe(true);
    });

    it('should load enterprise script', async () => {
      const enterpriseConfig: RecaptchaServiceConfig = {
        ...mockConfig,
        version: 'enterprise',
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: RECAPTCHA_CONFIG, useValue: enterpriseConfig },
        ],
      });
      service = TestBed.inject(RecaptchaService);

      const mockScript = {
        src: '',
        async: false,
        defer: false,
        onload: null as (() => void) | null,
        onerror: null,
      };
      (document.createElement as jest.Mock).mockReturnValue(mockScript);

      const loadPromise = service.loadScript();

      if (mockScript.onload) {
        mockScript.onload();
      }

      await loadPromise;

      expect(mockScript.src).toBe('https://www.google.com/recaptcha/enterprise.js?render=test-site-key');
    });

    it('should load v2 script without render parameter', async () => {
      const v2Config: RecaptchaServiceConfig = {
        ...mockConfig,
        version: 'v2',
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: RECAPTCHA_CONFIG, useValue: v2Config },
        ],
      });
      service = TestBed.inject(RecaptchaService);

      const mockScript = {
        src: '',
        async: false,
        defer: false,
        onload: null as (() => void) | null,
        onerror: null,
      };
      (document.createElement as jest.Mock).mockReturnValue(mockScript);

      const loadPromise = service.loadScript();

      if (mockScript.onload) {
        mockScript.onload();
      }

      await loadPromise;

      expect(mockScript.src).toBe('https://www.google.com/recaptcha/api.js');
    });

    it('should skip loading in SSR', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'server' },
          { provide: RECAPTCHA_CONFIG, useValue: mockConfig },
        ],
      });
      service = TestBed.inject(RecaptchaService);

      await service.loadScript();

      expect(document.createElement).not.toHaveBeenCalled();
    });

    it('should skip loading when disabled', async () => {
      const disabledConfig: RecaptchaServiceConfig = {
        ...mockConfig,
        enabled: false,
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: RECAPTCHA_CONFIG, useValue: disabledConfig },
        ],
      });
      service = TestBed.inject(RecaptchaService);

      await service.loadScript();

      expect(document.createElement).not.toHaveBeenCalled();
    });

    it('should handle script load error', async () => {
      const mockScript = {
        src: '',
        async: false,
        defer: false,
        onload: null,
        onerror: null as (() => void) | null,
      };
      (document.createElement as jest.Mock).mockReturnValue(mockScript);

      const loadPromise = service.loadScript();

      // Simulate script error
      if (mockScript.onerror) {
        mockScript.onerror();
      }

      await expect(loadPromise).rejects.toThrow('[RecaptchaService] Failed to load reCAPTCHA script');
    });
  });

  describe('v3 Execute', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: RECAPTCHA_CONFIG, useValue: mockConfig },
        ],
      });
      service = TestBed.inject(RecaptchaService);

      // Mock script already loaded
      mockWindow.grecaptcha = {
        execute: jest.fn().mockResolvedValue('mock-token'),
      };
    });

    it('should execute v3 reCAPTCHA and return token', async () => {
      const token = await service.execute('login');

      expect(token).toBe('mock-token');
      expect(mockWindow.grecaptcha?.execute).toHaveBeenCalledWith('test-site-key', { action: 'login' });
    });

    it('should use config action if not provided', async () => {
      const token = await service.execute();

      expect(token).toBe('mock-token');
      expect(mockWindow.grecaptcha?.execute).toHaveBeenCalledWith('test-site-key', { action: 'test' });
    });

    it('should skip in SSR', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'server' },
          { provide: RECAPTCHA_CONFIG, useValue: mockConfig },
        ],
      });
      service = TestBed.inject(RecaptchaService);

      const token = await service.execute('login');

      expect(token).toBeUndefined();
    });

    it('should skip when disabled', async () => {
      const disabledConfig: RecaptchaServiceConfig = {
        ...mockConfig,
        enabled: false,
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: RECAPTCHA_CONFIG, useValue: disabledConfig },
        ],
      });
      service = TestBed.inject(RecaptchaService);

      const token = await service.execute('login');

      expect(token).toBeUndefined();
    });

    it('should throw error for v2 config', async () => {
      const v2Config: RecaptchaServiceConfig = {
        ...mockConfig,
        version: 'v2',
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: RECAPTCHA_CONFIG, useValue: v2Config },
        ],
      });
      service = TestBed.inject(RecaptchaService);

      await expect(service.execute('login')).rejects.toThrow(
        '[RecaptchaService] execute() is only for v3/Enterprise. Use render() for v2.',
      );
    });
  });

  describe('v2 Render', () => {
    beforeEach(() => {
      const v2Config: RecaptchaServiceConfig = {
        ...mockConfig,
        version: 'v2',
      };

      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: RECAPTCHA_CONFIG, useValue: v2Config },
        ],
      });
      service = TestBed.inject(RecaptchaService);

      // Mock script already loaded
      mockWindow.grecaptcha = {
        render: jest.fn().mockReturnValue(123),
        getResponse: jest.fn().mockReturnValue('mock-v2-token'),
        reset: jest.fn(),
      };
    });

    it('should render v2 widget', async () => {
      const callback = jest.fn();
      const widgetId = await service.render('container', callback);

      expect(widgetId).toBe(123);
      expect(mockWindow.grecaptcha?.render).toHaveBeenCalledWith('container', {
        sitekey: 'test-site-key',
        callback: callback,
      });
    });

    it('should get response from v2 widget', () => {
      const response = service.getResponse();

      expect(response).toBe('mock-v2-token');
      expect(mockWindow.grecaptcha?.getResponse).toHaveBeenCalled();
    });

    it('should reset v2 widget', () => {
      service.reset();

      expect(mockWindow.grecaptcha?.reset).toHaveBeenCalled();
    });

    it('should throw error for v3 config', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          RecaptchaService,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: RECAPTCHA_CONFIG, useValue: mockConfig }, // v3 config
        ],
      });
      service = TestBed.inject(RecaptchaService);

      await expect(service.render('container', jest.fn())).rejects.toThrow(
        '[RecaptchaService] render() is only for v2. Use execute() for v3/Enterprise.',
      );
    });
  });
});
