// VELMARA: Streets of Gold — entry program for the make.fun gta6-01 bounty.
// Node 22, standard library only. It copies the playable game and the dossier
// screenshots from this repository into the output directory and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts,
// exactly as the bounty rules require. Run twice, it writes the same bytes.
//
// Usage outside the grader:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Paths are resolved from this file, never from the working directory.
const ROOT = dirname(fileURLToPath(import.meta.url));
const GAME_DIR = join(ROOT, 'game');
const SHOTS_DIR = join(ROOT, 'screenshots');
const OUT = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : '/output';

// The gate caps from the bounty (gate.json): the text cap shapes the dossier
// bytes; the other caps only refuse, so passing them makes this program fail
// exactly where the scorer would.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000
};

// Empty the output directory's contents without removing the directory itself:
// in the grader /output is a mount point, and removing it fails the run.
function emptyOutputDir(dir) {
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function main() {
  if (!existsSync(GAME_DIR)) throw new Error('missing game/ directory: ' + GAME_DIR);
  if (!existsSync(join(GAME_DIR, 'index.html'))) throw new Error('missing game/index.html');
  if (!existsSync(SHOTS_DIR)) throw new Error('missing screenshots/ directory: ' + SHOTS_DIR);
  const shots = readdirSync(SHOTS_DIR).filter((f) => !f.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) {
    throw new Error('screenshots/ must hold 3 or 4 images, found ' + shots.length);
  }

  emptyOutputDir(OUT);
  cpSync(GAME_DIR, join(OUT, 'game'), { recursive: true });
  cpSync(SHOTS_DIR, join(OUT, 'screenshots'), { recursive: true });
  writeFileSync(join(OUT, 'dossier.json'), buildDossier(OUT, CAPS));
}

main();
