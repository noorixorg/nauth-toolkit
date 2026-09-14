/**
 * Jest-only stand-in for @nestjs/common's utils/load-package.util.js.
 *
 * That file is ESM-only and calls `createRequire(import.meta.url)`, which ts-jest's
 * CommonJS transform cannot downlevel — TypeScript leaves `import.meta` untouched,
 * producing a SyntaxError under Node's CJS loader. None of our specs exercise the
 * optional-peer-dependency loading this util provides (used by Nest's
 * ClassSerializerInterceptor / ValidationPipe for class-transformer/class-validator,
 * which we always have installed directly), so a CJS-safe stub is enough to let
 * @nestjs/common's barrel parse under Jest.
 */
function loadPackage(packageName) {
  return Promise.resolve(require(packageName));
}

function loadPackageSync(packageName) {
  return require(packageName);
}

function loadPackageCached(packageName) {
  return require(packageName);
}

function tryLoadPackage(packageName) {
  try {
    return Promise.resolve(require(packageName));
  } catch {
    return Promise.resolve(null);
  }
}

module.exports = { loadPackage, loadPackageSync, loadPackageCached, tryLoadPackage };
