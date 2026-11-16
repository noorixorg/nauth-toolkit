// Two Jest projects, run as two separate `jest --selectProjects` passes by the package's
// `test` script, because they need different Node flags:
//
// - `oidc-provider` (src/) loads the ESM-only oidc-provider library through a real dynamic
//   import, so it runs with NODE_OPTIONS=--experimental-vm-modules.
// - `nestjs` (nestjs/) requires @nestjs/*, which NestJS 12 ships as ESM. Under
//   --experimental-vm-modules Jest refuses to require() an ES module before it can transform
//   it, so this project runs WITHOUT the flag and rewrites @nestjs/* to CommonJS instead.

const shared = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/../core/jest.setup.ts'],
};

const workspaceDists = {
  '^@nauth-toolkit/core$': '<rootDir>/../core/dist',
  '^@nauth-toolkit/core/internal$': '<rootDir>/../core/dist/internal',
  '^@nauth-toolkit/nestjs$': '<rootDir>/../nestjs/dist',
};

module.exports = {
  coverageDirectory: 'coverage',
  projects: [
    {
      ...shared,
      displayName: 'oidc-provider',
      roots: ['<rootDir>/src'],
      collectCoverageFrom: ['src/**/*.(t|j)s'],
      // TypeScript only. The workspace `dist` folders reached through moduleNameMapper are
      // already compiled JavaScript; handing them to ts-jest just produces allowJs warnings.
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      // Transform NOTHING in node_modules.
      //
      // oidc-provider is ESM-only and is loaded through a real dynamic import (hence
      // NODE_OPTIONS=--experimental-vm-modules in the test script). It imports named
      // exports from jose, which is also ESM-only — so jose must stay ESM too. Letting
      // ts-jest rewrite jose to CommonJS makes those named imports disappear and
      // oidc-provider fails to link with "does not provide an export named 'EmbeddedJWK'".
      transformIgnorePatterns: ['/node_modules/'],
      moduleNameMapper: workspaceDists,
    },
    {
      ...shared,
      displayName: 'nestjs',
      roots: ['<rootDir>/nestjs'],
      collectCoverageFrom: ['nestjs/**/*.(t|j)s'],
      transform: {
        '^.+\\.ts$': 'ts-jest',
        // @nestjs/* is ESM in NestJS 12; rewrite it (and only it) to CommonJS.
        '^.+/node_modules/@nestjs/.+\\.js$': 'ts-jest',
      },
      // Leave every other node_modules path untransformed.
      transformIgnorePatterns: ['^(?!.*/node_modules/@nestjs/).*/node_modules/'],
      moduleNameMapper: {
        ...workspaceDists,
        // @nestjs/common's load-package util and @nestjs/typeorm's compat shim use
        // import.meta.url, which the CommonJS rewrite cannot express. Reuse the CJS-safe
        // stubs the nestjs package's Jest config already maps them to.
        '.*/utils/load-package\\.util\\.js$': '<rootDir>/../nestjs/__mocks__/nestjs-load-package.util.js',
        '.*typeorm-compat\\.js$': '<rootDir>/../nestjs/__mocks__/nestjs-typeorm-compat.js',
      },
    },
  ],
};
