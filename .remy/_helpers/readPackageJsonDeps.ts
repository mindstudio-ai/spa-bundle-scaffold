import { promises as fs } from 'fs';
import path from 'path';

const PKG_JSON = path.resolve(process.cwd(), 'package.json');

// Get the current npm packages installed in package.json
export const readPackageJsonDeps = async (): Promise<Set<string>> => {
  try {
    const raw = await fs.readFile(PKG_JSON, 'utf8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return new Set([
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
    ]);
  } catch (err: any) {
    if (err && err.code === 'ENOENT') {
      return new Set();
    }
    throw err;
  }
};
