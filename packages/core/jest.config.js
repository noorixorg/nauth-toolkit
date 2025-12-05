module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  // Transform ESM modules like jose
  transformIgnorePatterns: ['node_modules/(?!(jose)/)'],
  // Setup reflect-metadata for TypeORM
  setupFilesAfterEnv: ['<rootDir>/../jest.setup.ts'],
};
