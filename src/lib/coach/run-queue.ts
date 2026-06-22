// Offline-first queue for GPS runs. When a save fails because the device is offline,
// the run is stored in localStorage and retried when connectivity returns, so a run
// recorded in a dead zone is never lost.

export type QueuedRun = {
  id: string;
  payload: unknown;
  queuedAt: number;
};

const KEY = "racedz-run-queue";

function read(): QueuedRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: QueuedRun[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage full / unavailable — best effort
  }
}

export function queueRun(payload: unknown, id: string): QueuedRun {
  const item: QueuedRun = { id, payload, queuedAt: Date.now() };
  write([...read(), item]);
  return item;
}

export function getQueuedRuns(): QueuedRun[] {
  return read();
}

export function removeQueuedRun(id: string) {
  write(read().filter((item) => item.id !== id));
}

export function queuedRunCount(): number {
  return read().length;
}
