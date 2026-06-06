import { describe, it, expect } from 'vitest';
import { existsSync, statSync, readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(import.meta.dirname, '../..');
const serverRoot = resolve(import.meta.dirname, '..');

describe('server scaffold', () => {
  it('module entry point exists', () => {
    expect(existsSync(resolve(serverRoot, 'src/index.ts'))).toBe(true);
    expect(existsSync(resolve(serverRoot, 'src/module.ts'))).toBe(true);
  });

  it('dev helper script exists and is executable', () => {
    const devSh = resolve(serverRoot, 'scripts/dev.sh');
    expect(existsSync(devSh)).toBe(true);
    const mode = statSync(devSh).mode;
    expect(mode & 0o111).toBeGreaterThan(0);
  });

  it('server package.json has all required spacetime scripts', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(serverRoot, 'package.json'), 'utf8')
    );
    for (const script of ['spacetime:build', 'spacetime:start', 'spacetime:publish', 'generate']) {
      expect(pkg.scripts[script], `missing script: ${script}`).toBeDefined();
    }
  });

  it('root package.json delegates spacetime commands', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(root, 'package.json'), 'utf8')
    );
    for (const script of ['spacetime:build', 'spacetime:start', 'generate']) {
      expect(pkg.scripts[script], `missing root script: ${script}`).toBeDefined();
    }
  });
});
