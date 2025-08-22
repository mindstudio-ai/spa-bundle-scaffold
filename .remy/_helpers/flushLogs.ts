export interface LogItem {
  value: string;
  timestampMs: number;
}

export const flushLogs = async (logs: LogItem[]) => {
  try {
    await fetch(
      `${process.env.REMOTE_HOSTNAME}/v1/apps/load/appId/_hooks/spa-build-servers/append-logs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${process.env.CALLBACK_TOKEN}`,
        },
        body: JSON.stringify({ logs }),
      }
    );
  } catch {
    // ignore
  }
};
