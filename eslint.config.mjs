import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  // Ignore patterns
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.js',
      '**/*.mjs',
      '**/.*.js',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      '**/capacitor.config.ts', // Capacitor config doesn't need strict linting
      'tests/**', // E2E tests excluded from linting
      '**/*.spec.ts', // Spec files excluded from tsconfig
      'packages/email/console/src/templates/html-template.engine.spec.ts', // Test file excluded from tsconfig
      'packages/email/nodemailer/src/templates/html-template.engine.spec.ts', // Test file excluded from tsconfig
      'packages/social/google/src/token-verifier.service.spec.ts', // Test file excluded from tsconfig
    ],
  },

  // Base ESLint config
  eslint.configs.recommended,

  // TypeScript files configuration
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
        ecmaVersion: 2022,
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        console: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        // Jest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettier,
      'unused-imports': unusedImports,
    },
    rules: {
      // ============================================================================
      // Prettier Integration
      // ============================================================================
      'prettier/prettier': 'error',

      // ============================================================================
      // TypeScript Best Practices
      // ============================================================================
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn', // ✅ PROJ_RULES: Warn instead of error (too many in interfaces)
      '@typescript-eslint/no-unused-vars': 'off', // Handled by unused-imports plugin
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-empty-interface': 'warn',

      // ============================================================================
      // Unused Imports (Auto-remove on save)
      // ============================================================================
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn', // Changed to warn (too noisy as error)
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          // Ignore unused params in interface method signatures
          ignoreRestSiblings: true,
        },
      ],

      // ============================================================================
      // General Best Practices
      // ============================================================================
      'no-console': ['warn', { allow: ['warn', 'error'] }], // ✅ PROJ_RULES: No console.log
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'warn',
      'object-shorthand': 'warn',
      'no-duplicate-imports': 'error',
      'no-unused-vars': 'off', // Use TypeScript version instead

      // ============================================================================
      // Code Quality
      // ============================================================================
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-throw-literal': 'error',
      'no-return-await': 'off', // Stylistic only, not a real issue
      'require-await': 'off', // Too noisy for interfaces
      'no-undef': 'off', // TypeScript handles this better
    },
  },

  // Override for test files
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true, // Use projectService for test files too
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' in tests
      'no-console': 'off', // Allow console in tests
      'unused-imports/no-unused-vars': 'off', // Don't warn in tests
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },

  // Override for interface files (unused params are expected!)
  {
    files: ['**/*.interface.ts', '**/interfaces/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Interfaces need flexibility
      'unused-imports/no-unused-vars': 'off', // Method signatures have unused params
      'no-unused-vars': 'off', // Method signatures have unused params
    },
  },

  // Override for provider files (console.log is intentional for dev tools)
  {
    files: ['**/console-*.provider.ts'],
    rules: {
      'no-console': 'off', // Console providers log to console by design
      'require-await': 'off', // Providers implement async interfaces
    },
  },

  // Prettier config (must be last to override other formatting rules)
  prettierConfig,
];
