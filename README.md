# VELMARA: Streets of Gold

An original open-world crime game for the make.fun **gta6-01** bounty — built from
scratch, playable in a desktop browser from static files, no network requests.

**Velmara** is a sun-soaked harbor city. You are **Riko Vale**, a courier with a debt.
Marisol, the fixer of Puerto del Sol, offers a way out: five jobs, one gold run, and
every siren in town. Explore on foot or behind the wheel, steal cars, outrun the
Velmara police, and take back the streets.

## Play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static server),
then click **NEW GAME**. Keyboard + mouse.

| Input | Action |
|---|---|
| W A S D / arrows | Move on foot / drive |
| Mouse + click | Aim / punch or shoot |
| SHIFT | Sprint / handbrake |
| E | Enter / exit a car |
| 1 / 2 | Fists / pistol |
| R | Buy ammo ($50) |
| P / Esc | Pause & save |
| M | Sound on/off |

## What's in the game

- **A city to explore**: Centro's towers, Casco Viejo's pastel lanes, Las Lomas,
  Parque Verde, and the harbor — Puerto del Sol, Playa Dorada, docks and a yacht.
- **On foot and by car**: walk, sprint, steal parked or occupied cars, drive with
  traffic that follows the road graph.
- **Traffic and pedestrians**: cars keep their lane and brake for each other;
  pedestrians walk the sidewalks and flee gunfire and crashes.
- **Wanted level + police**: 0–5 stars. Cop cars chase and ram, foot cops chase and
  arrest, and at 3 stars they shoot back. Lose the heat, pay-n-spray at Pintura Rosa
  ($300), or get busted.
- **Missions and story**: five jobs for Marisol — a courier run, a hot-wheels theft,
  a harbor meet under police lights, a shakedown of three shops, and the final gold
  run — plus repeatable taxi fares once the story opens up.
- **Combat**: fists and a pistol, muzzle flash, tracers, health and ammo pickups.
- **HUD + minimap**: objective tracker with distance, wanted stars, cash, clock,
  health, weapon, and a live minimap with mission, police and fare blips.
- **Start, pause, save**: title screen with story intro, pause menu, and
  localStorage saves (auto-saved on mission completion).
- **Polish**: day/night cycle with sunset and headlights, engine and siren audio,
  a synthwave loop, skid marks, smoke, particles, screen shake — all synthesized,
  no assets, no network.

## Tech

- Pure HTML/CSS/JavaScript on one `<canvas>` — no engine, no libraries, no build step.
- `game/src/` is split by job: `config`, `random`, `city`, `audio`, `input`,
  `peds`, `vehicles`, `police`, `player`, `missions`, `hud`, `render`, `shots`, `main`.
- `game/index.html?shot=1..4` stages a live scene for screenshots (a chase, the
  marina, the docks at dusk, a taxi fare at golden hour) — the game itself plays.
- `main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to `/output`
  and writes `dossier.json` with `vendor/makefun-game.ts`.

## Originality

Velmara, Riko Vale, Marisol, its streets, cars, story, art, sounds and music are all
invented for this game. Nothing is taken from Rockstar Games, Grand Theft Auto, or
any other commercial game.

## License

MIT — see `LICENSE`.
