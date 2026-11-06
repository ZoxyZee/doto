let handler: (() => void) | null = null;

export function registerSyncHandler(next: () => void): () => void {
  handler = next;
  return () => { if (handler === next) handler = null; };
}

export function notifyLocalChange(): void { handler?.(); }
