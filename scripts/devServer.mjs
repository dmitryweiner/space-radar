// Shared by smoke/snap: find (or start) a Vite server that is serving
// *this* app. Another project's dev server often sits on Vite's default
// :5173, so a port answering 200 isn't enough — the page must be Space Radar.
// Walks a small port range: reuses a Space Radar server if one is already up,
// skips ports taken by anything else, and spawns one on the first free port.
//
//   const { base, stop } = await ensureServer({ preview });
import { spawn } from 'node:child_process';

const MARKER = '<title>Space Radar';
const RANGE = 10;

async function probe(base) {
  try {
    const res = await fetch(base);
    const html = await res.text();
    return html.includes(MARKER) ? 'ours' : 'foreign';
  } catch {
    return 'free';
  }
}

export async function ensureServer({ preview = false } = {}) {
  const first = preview ? 4173 : 5173;
  for (let port = first; port < first + RANGE; port++) {
    const base = `http://localhost:${port}`;
    const state = await probe(base);
    if (state === 'ours') return { base, stop: () => {} };
    if (state === 'foreign') continue;
    const cmd = preview
      ? ['vite', 'preview', '--port', String(port), '--strictPort']
      : ['vite', '--port', String(port), '--strictPort'];
    // Own process group: `npx` forks the real vite process, and killing only
    // npx would leave vite running (an orphan that the next run then reuses —
    // with whatever env it was started with).
    const proc = spawn('npx', cmd, { stdio: 'ignore', detached: true });
    const stop = () => {
      try {
        process.kill(-proc.pid);
      } catch {
        // already gone
      }
    };
    for (let i = 0; i < 30 && (await probe(base)) !== 'ours'; i++) await new Promise((r) => setTimeout(r, 1000));
    if ((await probe(base)) !== 'ours') {
      stop();
      throw new Error(`server did not start on :${port}`);
    }
    return { base, stop };
  }
  throw new Error(`no free port in ${first}..${first + RANGE - 1}`);
}
