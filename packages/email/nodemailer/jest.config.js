const path = require('path');

module.exports = {
  preset: 'ts-jest',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../tsconfig.json',
      },
    ],
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(jose)/)',
  ],
  moduleNameMapper: {
    // Use built core outputs to avoid compiling the entire core source tree as part of this package's tests.
    '^@nauth-toolkit/core$': path.resolve(__dirname, '../../core/dist/index'),
    '^@nauth-toolkit/core/(.*)$': path.resolve(__dirname, '../../core/dist/$1'),
  },
  setupFilesAfterEnv: [path.resolve(__dirname, '../../core/jest.setup.ts')],
};
