module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.spec.ts'],
  coverageDirectory: '../coverage',
  coverageThreshold: {
    global: {
      statements: 75,
      branches: 57,
      functions: 70,
      lines: 75,
    },
  },
  testEnvironment: 'node',
  // Transform ESM modules like jose (pattern accounts for pnpm's .pnpm directory)
  transformIgnorePatterns: ['node_modules/(?!(\\.pnpm|jose)/)'],
  // Setup reflect-metadata for TypeORM
  setupFilesAfterEnv: ['<rootDir>/../jest.setup.ts'],
};
