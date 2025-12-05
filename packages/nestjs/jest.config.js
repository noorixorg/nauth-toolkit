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
  // Transform ESM modules like jose
  transformIgnorePatterns: ['node_modules/(?!(jose)/)'],
  moduleNameMapper: {
    '^@nauth-toolkit/core$': path.resolve(__dirname, '../core/src/index'),
    '^@nauth-toolkit/core/(.*)$': path.resolve(__dirname, '../core/src/$1'),
  },
  // Setup reflect-metadata for TypeORM and NestJS decorators
  setupFilesAfterEnv: ['<rootDir>/../jest.setup.ts'],
};
