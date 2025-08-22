export const extractExternalPackages = (
  code: string,
): string[] => {
  const packages = new Set<string>();

  // Match ES imports: import ... from 'pkg'
  const importRegex = /import(?:["'\s]*[\w*{}\n\r\t, ]+from\s*)?["']([^"']+)["']/g;

  // Match require: const x = require('pkg')
  const requireRegex = /require\(["']([^"']+)["']\)/g;

  // Helper: only keep external packages, not relative or absolute paths
  const isExternal = (name: string) =>
    !name.startsWith('.') && !name.startsWith('/') && !name.match(/^[A-Za-z]:\\/);

  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(code)) !== null) {
    if (isExternal(match[1])) {
      packages.add(match[1].split('/')[0].startsWith('@') ? match[1].split('/').slice(0, 2).join('/') : match[1].split('/')[0]);
    }
  }

  while ((match = requireRegex.exec(code)) !== null) {
    if (isExternal(match[1])) {
      packages.add(match[1].split('/')[0].startsWith('@') ? match[1].split('/').slice(0, 2).join('/') : match[1].split('/')[0]);
    }
  }

  return Array.from(packages);
};
