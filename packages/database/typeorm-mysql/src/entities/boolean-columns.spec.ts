import * as fs from 'fs';
import * as path from 'path';

/**
 * Boolean columns must be declared `boolean`, never `tinyint`.
 *
 * MySQL stores both identically - `boolean` is a synonym for `tinyint(1)` - but TypeORM
 * only converts the stored 1/0 back into a real boolean when the column is declared
 * `boolean`. Declared as `tinyint`, every read returns a number, which silently broke
 * strict comparisons against these fields on MySQL while Postgres behaved correctly.
 *
 * The DDL is the same either way, so this costs nothing and is checked here rather than
 * left to a code review that would have to notice a one-word difference.
 */
describe('MySQL entity boolean columns', () => {
  const entityDir = __dirname;
  const entityFiles = fs.readdirSync(entityDir).filter((f) => f.endsWith('.entity.ts'));

  it('has entity files to check', () => {
    expect(entityFiles.length).toBeGreaterThan(0);
  });

  it.each(entityFiles)('declares no boolean column as tinyint in %s', (file) => {
    const source = fs.readFileSync(path.join(entityDir, file), 'utf8');
    const lines = source.split('\n');
    const offenders: string[] = [];

    lines.forEach((line, index) => {
      if (!line.includes("type: 'tinyint'")) {
        return;
      }
      // A tinyint is only a problem when the property it decorates is a boolean.
      const following = lines.slice(index + 1, index + 4).join(' ');
      const declaration = /declare (\w+)\??:\s*([^;]+);/.exec(following);
      if (declaration && declaration[2].includes('boolean')) {
        offenders.push(`${declaration[1]} (line ${index + 1})`);
      }
    });

    expect(offenders).toEqual([]);
  });
});
