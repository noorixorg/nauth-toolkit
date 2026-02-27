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
  moduleNameMapper: {
    '^@nauth-toolkit/core$': '<rootDir>/../../../core/dist',
    '^@nauth-toolkit/core/internal$': '<rootDir>/../../../core/dist/internal',
  },
  setupFilesAfterEnv: ['<rootDir>/../../../core/jest.setup.ts'],
};

