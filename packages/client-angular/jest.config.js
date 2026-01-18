const path = require('path');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }] },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/**/public-api.ts', '!src/standalone/**'],
  coverageDirectory: '<rootDir>/coverage',
  moduleNameMapper: {
    '^@angular/core$': '<rootDir>/__mocks__/angular-core',
    '^@angular/router$': '<rootDir>/__mocks__/angular-router',
    '^@angular/common$': '<rootDir>/__mocks__/angular-common',
    '^@angular/common/http$': '<rootDir>/__mocks__/angular-common-http',
    '^@nauth-toolkit/client$': path.resolve(__dirname, '../client/src'),
  },
  transformIgnorePatterns: ['node_modules/(?!(@nauth-toolkit/client)/)'],
};
