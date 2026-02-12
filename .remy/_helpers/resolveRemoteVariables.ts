const REMOTE_PREFIX = '@@remote_variable@@';
const FETCH_TIMEOUT_MS = 10_000;

export const resolveRemoteVariables = async (input: Record<string, any>): Promise<Record<string, any>> => {
  const entries = Object.entries(input);

  const resolvedPairs = await Promise.all(
    entries.map(async ([key, val]) => {
      if (typeof val === 'string' && val.startsWith(REMOTE_PREFIX)) {
        const url = val.slice(REMOTE_PREFIX.length).trim();
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
          const remote = await fetch(url, { signal: controller.signal }).then(res => res.json());
          clearTimeout(timeout);
          if (remote && typeof remote === 'object' && 'value' in remote) {
            let { value } = remote;
            try {
              value = JSON.parse(value);
            } catch {
              //
            }

            return [key, value] as const;
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
