/**
 * Jest-only stand-in for @nestjs/typeorm's common/typeorm-compat.js.
 *
 * That file is ESM-only and declares `const require = createRequire(import.meta.url)`
 * at module scope, which collides with the `require` parameter ts-jest's CommonJS
 * wrapper already injects ("Identifier 'require' has already been declared"). It only
 * exists to lazily resolve TypeORM's legacy `Connection` / `AbstractRepository` exports
 * (removed in TypeORM v1) without a static type dependency — a plain CJS `require` does
 * the same thing safely here.
 */
function resolveTypeormExport(exportName) {
  try {
    const typeorm = require('typeorm');
    return typeorm[exportName];
  } catch {
    return undefined;
  }
}

module.exports = {
  Connection: resolveTypeormExport('Connection'),
  AbstractRepository: resolveTypeormExport('AbstractRepository'),
};
