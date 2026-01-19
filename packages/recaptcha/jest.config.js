module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/nestjs'],
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'nestjs/**/*.ts',
    '!src/**/*.spec.ts',
    '!nestjs/**/*.spec.ts',
    '!src/index.ts',
    '!nestjs/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 60,
      lines: 80,
      statements: 80,
    },
  },
};
