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
- **Mastersheet**: the whole game in order, an arc for each level cap ending with its boss, with
  every team and wild encounter. If your route differs, turn on Reorder: ▲ / ▼ carry a trainer
  earlier or later (past boss fights too), a place's menu moves all its trainers before another
  fight, and Copy order changes gives you the changes to send in.
- **Trainer AI**: the chance the foe picks each move, and when it switches and to whom (see below).
- **Genders** as the game rolls them, so Rivalry and Attract work.
- **Minimal Grinding** (Settings; set by importing your `.sav`): with it on the game gives
  trainers' Pokémon no EVs, and the calc follows. Hardcore always has it on.
- **Trainer pictures** beside each trainer (their own for leaders, rivals and the Elite Four, else
  their class), **item icons** before each item, and **type badges** on the Battle tab.

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
- **Backup** (Import / Export; More on small screens): everything the calc keeps in your browser
  (every mode's box, runs, personal bests, settings, Fight Notes) as one file, restored on this
  device or another. It asks first, then replaces what's saved.
- **Install** it as an app (More → App, or Chrome's ⋮ → Add to Home screen) and it **works
  offline**. The [Pcalc](https://github.com/kvarflow/Pcalc) Android app packs it too, with
  RetroArch sync built in and automatic backups to a folder on the device.
- **Emulator sync**: the battle sent live from mGBA (a Lua script) or RetroArch (a Python
  script), both in `src/emulator/`: who is out, HP, status, stat changes, and what has happened
  (the moves used last, Substitute, Taunt, Encore...) for the trainer's AI.

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
- **This turn**: the Turn button beside the foe's moves holds what has happened in the battle:
  tap the move each side used last turn and tick what applies (a Choice lock, Encore, Disable,
  Taunt, Protects in a row, a Substitute, Yawn, Perish Song, recharging...). Left alone it is a
  fresh battle. Set the field (weather, screens, hazards, Trick Room) and both Pokémon's HP and
  status as they are; benched Pokémon are taken at full HP.
- **Double battles** (a first version): Doubles, beside Turn, shows both Pokémon on each side and,
  for each of the trainer's two, how often it uses each move on each of yours. It follows CFRU's
  doubles AI: attacking moves and targets (who it knocks out, who threatens it, what its partner
  is already doing) and the doubles rules for status moves (Trick Room, Fake Out, Protect and
  Wide Guard, Follow Me, Tailwind, speed control). Switching and moves aimed at its own partner
  are not in yet.
- **A wrong prediction?** Copy AI report (beside What's new) copies the fight as it stands, both
  Pokémon, the field and what was predicted, to send in.

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
- **Trainer pictures**: Pokémon Showdown's trainer sprites, matched to each trainer's class and id
  in the ROM (`import/radical-red-trainers/trainer_sprites.js`).
- **Item icons**: [PokeAPI/sprites](https://github.com/PokeAPI/sprites) (CC0; the art is The
  Pokémon Company's), matched by `import/item-icons.js`.
- **Every image is kept in this repo** (`src/img/`: Pokémon sprites, trainer pictures, item icons,
  Professor Oak), copied in by `import/vendor-images.sh` from pinned versions of their sources, so
  the calc loads nothing from other sites (and works offline as a whole, as the Pcalc app packs it).
  Re-run the script after the trainer sprites or item icons change.
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
- Sprites: [May8th1995/sprites](https://github.com/May8th1995/sprites); trainer pictures from
  Pokémon Showdown; Professor Oak from [smogon/sprites](https://github.com/smogon/sprites). All are
  Nintendo / Game Freak / The Pokémon Company's artwork, kept in `src/img/`.
- Further features by kvarflow.

## License

[MIT](LICENSE).
