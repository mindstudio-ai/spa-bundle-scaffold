const REMOTE_PREFIX = '@@remote_variable@@';

async function resolveRemoteVariables(input: Record<string, any>): Promise<Record<string, any>> {
  const entries = Object.entries(input);

  const resolvedPairs = await Promise.all(
    entries.map(async ([key, val]) => {
      if (typeof val === 'string' && val.startsWith(REMOTE_PREFIX)) {
        const url = val.slice(REMOTE_PREFIX.length).trim();
        try {
          const remote = await fetch(url).then(res => res.json());
          if (remote && typeof remote === 'object' && 'value' in remote) {
            return [key, remote.value] as const;
          }
        } catch {
          // swallow errors in dev
        }
      }
      return [key, val] as const;
    })
  );

  return Object.fromEntries(resolvedPairs);
}
