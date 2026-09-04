module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/nestjs'],
  testRegex: '.*\\.spec\\.ts$',
  // TypeScript only. The workspace `dist` folders reached through moduleNameMapper are
  // already compiled JavaScript; handing them to ts-jest just produces allowJs warnings.
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s', 'nestjs/**/*.(t|j)s'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  // Transform NOTHING in node_modules.
  //
  // oidc-provider is ESM-only and is loaded through a real dynamic import (hence
  // NODE_OPTIONS=--experimental-vm-modules in the test script). It imports named
  // exports from jose, which is also ESM-only — so jose must stay ESM too. Letting
  // ts-jest rewrite jose to CommonJS makes those named imports disappear and
  // oidc-provider fails to link with "does not provide an export named 'EmbeddedJWK'".
  transformIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^@nauth-toolkit/core$': '<rootDir>/../core/dist',
    '^@nauth-toolkit/core/internal$': '<rootDir>/../core/dist/internal',
    '^@nauth-toolkit/nestjs$': '<rootDir>/../nestjs/dist',
  },
  setupFilesAfterEnv: ['<rootDir>/../core/jest.setup.ts'],
};
