// Get imported NPM packages by analyzing code
export const extractExternalPackages = (code: string): string[] => {
  const packages = new Set<string>();

  // Matches:
  //   import 'pkg'
  //   import x from 'pkg'
  //   import { a as b } from "pkg"
  const importRegex =
    /import\s+(?:(?:[\w*\s{},]+)\s+from\s+)?["']([^"']+)["']/g;

  // Matches: const x = require('pkg')
  const requireRegex = /require\(\s*["']([^"']+)["']\s*\)/g;

  // Matches: export * from 'pkg' / export { x } from "pkg"
  const exportFromRegex =
    /export\s+(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/g;

  // Matches: const m = await import('pkg')
  const dynamicImportRegex = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

  const isExternal = (name: string) =>
    !name.startsWith('.') &&
    !name.startsWith('/') &&
    !name.startsWith('file:') &&
    !/^[A-Za-z]:\\/.test(name); // Windows absolute paths

  const toBasePackage = (name: string) => {
    if (!isExternal(name)) return null;
    const parts = name.split('/');
    // Keep @scope/name for scoped packages
    if (name.startsWith('@')) return parts.slice(0, 2).join('/');
    // Otherwise keep the first segment
    return parts[0];
  };

  const addMatches = (re: RegExp) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      const base = toBasePackage(m[1]);
      if (base) packages.add(base);
    }
  };

  addMatches(importRegex);
  addMatches(requireRegex);
  addMatches(exportFromRegex);
  addMatches(dynamicImportRegex);

  return Array.from(packages);
};
