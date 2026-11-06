# Radical Red Damage Calculator

A damage calculator for **Pokémon Radical Red 4.1**, built for Nuzlocke runs: import your save,
step through every trainer in the order you meet them, and see what the trainer's AI is likely to
do. It works on desktop, phones and handhelds like the AYN Thor, and offline once opened.

**Use it at https://kvarflow.github.io/rr-calc/** (Normal Mode, Hardcore Mode and One vs One).

It is a fork of the [Pokémon Showdown damage calculator](https://github.com/smogon/damage-calc),
with Radical Red's data read from the game itself.

## Features

**Your run**
- **Import your `.sav`** (More → Import .sav): your party and boxes with their real stats, IVs,
  EVs, natures, abilities and genders, locked so they can't drift from the game. A new trainer ID
  starts a new run.
- **Box**: Team, Box, Box 2, Fainted and Trash. Drag between them, rank the box against the
  current foe, and colour code each matchup (who's faster, who OHKOs).
- **Run record**: mark KOs and faints; the Frag sheet lists every Pokémon's KOs per arc, and
  Professor Oak ends a run into your history and personal best.
- **Suggested EVs**: a general spread, and one tailored to the next boss.

**Trainers**
- **Every trainer in order**: bosses from the Normal and Hardcore boss documents, route trainers
  from the ROM, sorted by where they stand on the map. Previous / Next steps through them; the
  level cap follows your badges.
- **Mastersheet**: the whole game in order with every team and wild encounter. Reorder trainers
  there if your route differs.
- **Trainer AI**: the chance the foe picks each move, and when it switches and to whom (see below).
- **Genders** as the game rolls them, so Rivalry and Attract work.

**Reference**
- **Dex**: stats, evolutions, abilities, level-up / TM / tutor / egg moves, where to catch it, and
  who uses it.
- **Wild**: every location's encounters by method and time of day, in route order, with a
  Nuzlocke tracker (one per location, dupes clause).
- **?** beside abilities and items explains them, with Radical Red's own text.

**Anywhere**
- **Small screens** (640 px or less on the short side, like the Thor's lower screen) get a tabbed
  layout: Battle, You, Foe, Advanced, Box, Wild, More. Swipe between tabs. Phones held upright put
  the tabs at the bottom.
- **Desktop** has a modern card layout (Settings → Desktop style switches back to Classic).
- **Back up / Restore** (Settings → Data): everything the calc keeps in your browser as one
  file, to keep safe or move to another device. Restoring replaces that browser's data, but keeps
  its own layout and text size.
- **Install** it as an app (More → App, or Chrome's ⋮ → Add to Home screen) and it **works
  offline**.
- **Emulator sync**: your party sent live from mGBA (a Lua script) or RetroArch (a Python
  script), both in `src/emulator/`.

## Trainer AI

Radical Red runs on Complete Fire Red Upgrade (CFRU), and `src/js/trainer_ai.js` ports its battle
AI for single battles, checked against Radical Red's own code decompiled from the ROM:

- **Moves**: every move starts at 100 points. Moves that would fail or waste the turn lose points;
  smart trainers (all bosses) add points for a KO that moves first, the strongest move, and status
  or set-up that suits the Pokémon's style. Damage is judged as the calc's highest roll × 0.93.
  The AI's own random rolls are enumerated, so the percentages are exact for what the calc knows.
- **Switching**: it may switch before moving (to absorb your attack, escape a KO, when its moves
  are all bad, and so on). The best replacement is scored on whether it KOs you, resists you,
  outspeeds you or revenge kills. Battle shows the chance and who comes in, and who comes in after
  a KO.
- **Assumptions**: no moves used yet this battle, benched Pokémon at full HP, no Substitutes. Set
  the field (weather, screens, hazards, Trick Room) and both Pokémon's HP and status as they are.
  Double battles show damage but the predictions are for single battles.

Each trainer's AI flags and every move's effect come from the ROM
(`import/radical-red-trainers/ai_flags.js`).

## Where the data comes from

- **Trainers**: the Radical Red 4.1 Default and Hardcore boss documents (`src/js/data/trainers/`,
  built by `import/radical-red-trainers/`), with the rival's teams per starter, teams the
  documents leave out, route trainers, trainer ids, map positions and genders read from the ROM.
- **Encounters** (`src/js/data/encounters.js`): the game's encounter tables, with area names from
  [pret/pokefirered](https://github.com/pret/pokefirered) and the community's Pokémon Locations
  sheet.
- **Learnsets, evolutions, gender ratios and ability text**: the ROM, falling back to Pokémon
  Showdown's descriptions via [@pkmn/dex](https://github.com/pkmn/ps).
- **Save format**: [PKForge](https://github.com/sofianeelhor/PKForge)'s Radical Red engine; id
  tables from [Rad-Red-4.1-Team-Exporter](https://github.com/eliyahu1702/Rad-Red-4.1-Team-Exporter)
  and growth rates from [PokéAPI](https://github.com/PokeAPI/pokeapi).

No ROM data is stored in this repository beyond the derived tables above.

## Development

```sh
npm install && (cd calc && npm install)
node build          # compiles calc/ and builds the site into dist/
node build view     # faster: rebuilds only the site (src/), not calc/
npm test            # calc tests, build and lint
./publish-pages     # builds and publishes dist/ to the gh-pages branch (GitHub Pages)
```

Open `dist/normal.html` (or serve `dist/`) to try it.

- `src/game.template.html` is the one page template; `build` writes a page per game and mode from
  `src/js/games.js`. Edit the template, not the generated pages.
- `src/js/` is the UI (jQuery, ES5), one file per feature; `src/css/main.css` and
  `src/css/desktop.css` style it; `src/sw.js` is the offline service worker.
- `calc/` is the damage engine (`@smogon/calc`, TypeScript) with Radical Red's mechanics changes.
- `import/` holds the scripts that build `src/js/data/` from the boss documents and game data.

The engine's own documentation (installing and using `@smogon/calc` as a package) is upstream at
[smogon/damage-calc](https://github.com/smogon/damage-calc#smogoncalc).

## Credits

- The original calculator was created by Honko and is maintained by Austin and Kris; see
  [smogon/damage-calc](https://github.com/smogon/damage-calc) and its
  [contributors](https://github.com/smogon/damage-calc/graphs/contributors). Radical Red support
  was edited by Karthik.
- The Team/Box panel, matchup colour coding, crit chances, Range Compare, Export All, the panel
  toggles, base stat overrides and the trainer panel are ported from SylmarDev's
  [syl-rnb-calc](https://github.com/SylmarDev/syl-rnb-calc) (MIT).
- The Mastersheet and Frag sheet follow hzla's Dynamic Calc.
- Sprites: [May8th1995/sprites](https://github.com/May8th1995/sprites); Professor Oak from
  [smogon/sprites](https://github.com/smogon/sprites).
- Further features by kvarflow.

## License

[MIT](LICENSE).
