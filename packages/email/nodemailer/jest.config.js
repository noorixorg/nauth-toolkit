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
  collectCoverageFrom: [
    '**/*.(t|j)s',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(jose)/)',
  ],
  moduleNameMapper: {
    '^@nauth-toolkit/core$': path.resolve(__dirname, '../../core/src/index'),
    '^@nauth-toolkit/core/(.*)$': path.resolve(__dirname, '../../core/src/$1'),
  },
};
