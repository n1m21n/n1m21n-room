// Persistence: snapshot of every subsystem plus a lastSeen timestamp; on return, catchUp(elapsed) fast-forwards
// analytically (decay traces/neuro, regime transitions, a few off-screen ledger events) instead of stepping per frame.
const KEY = 'n1m21n.sim.v1';
export function makeStorage(key = KEY, backend = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  return {
    load() { try { const s = backend?.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; } },
    save(obj) { try { backend?.setItem(key, JSON.stringify(obj)); return true; } catch { return false; } },
    clear() { try { backend?.removeItem(key); } catch {} },
  };
}
export const memoryBackend = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
