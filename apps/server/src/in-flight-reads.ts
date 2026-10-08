/** Coalesce simultaneous reads only. Every request after settlement starts a fresh read. */
export function inFlightReads<T>() {
  const pending = new Map<string, Promise<T>>();
  return (key: string, read: () => Promise<T>): Promise<T> => {
    const existing = pending.get(key);
    if (existing) return existing;
    const promise = Promise.resolve().then(read).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
}
