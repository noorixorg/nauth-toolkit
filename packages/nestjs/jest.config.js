const path = require('path');

module.exports = {
  preset: 'ts-jest',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../tsconfig.json',
      },
    ],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  // Transform ESM modules like jose and @nestjs/* (NestJS 12 ships its core packages as ESM)
  transformIgnorePatterns: ['node_modules/(?!(\\.pnpm|jose|@nestjs)/)'],
  moduleNameMapper: {
    '^@nauth-toolkit/core$': path.resolve(__dirname, '../core/src/index'),
    '^@nauth-toolkit/core/(.*)$': path.resolve(__dirname, '../core/src/$1'),
    // @nestjs/common's load-package.util.js is ESM-only (uses import.meta.url), which
    // ts-jest's CommonJS transform can't downlevel. Redirect it to a CJS-safe stub.
    '.*/utils/load-package\\.util\\.js$': path.resolve(__dirname, '__mocks__/nestjs-load-package.util.js'),
    // Same issue in @nestjs/typeorm's compat shim: `const require = createRequire(import.meta.url)`
    // collides with ts-jest's injected CommonJS `require` parameter.
    '.*typeorm-compat\\.js$': path.resolve(__dirname, '__mocks__/nestjs-typeorm-compat.js'),
  },
  // Setup reflect-metadata for TypeORM and NestJS decorators
  setupFilesAfterEnv: ['<rootDir>/../jest.setup.ts'],
};
