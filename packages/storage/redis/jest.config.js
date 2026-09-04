module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  // TypeScript only. `@nauth-toolkit/core` is reached through moduleNameMapper as
  // already-compiled JavaScript; handing it to ts-jest only produces allowJs warnings.
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@nauth-toolkit/core$': '<rootDir>/../../../core/dist',
    '^@nauth-toolkit/core/internal$': '<rootDir>/../../../core/dist/internal',
  },
  setupFilesAfterEnv: ['<rootDir>/../../../core/jest.setup.ts'],
};
