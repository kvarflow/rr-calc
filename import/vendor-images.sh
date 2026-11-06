#!/usr/bin/env bash
# Copies every image the calculator shows into src/img/, so the site (and the Pcalc app, which
# packs it) loads nothing from other sites. Run it again after the trainer sprites
# (src/js/data/trainer_sprites/*.js) or item icons (src/js/data/item_icons.js) change.
#
#   src/img/sprites/  Pokémon, from May8th1995/sprites (the set syl-rnb-calc uses), at SPRITES_COMMIT.
#                     Names as the calc's species; accented names are stored in NFC form.
#   src/img/trainers/ Trainer pictures named in data/trainer_sprites/*.js, from Pokémon Showdown.
#   src/img/items/    Item icons named in data/item_icons.js, from PokeAPI/sprites at ITEMS_COMMIT.
#   src/img/oak.png   Professor Oak (FireRed / LeafGreen), from smogon/sprites.
#
# Usage: import/vendor-images.sh   (needs git, curl, node, python3)
set -euo pipefail
cd "$(dirname "$0")/.."

SPRITES_COMMIT=e0772c1ad5b2a293c7ac0fde7abfd423f45a92e1
ITEMS_COMMIT=1b3b7c0a538dd2226ae08d0d2f8955125075bbd4
OAK_URL=https://raw.githubusercontent.com/smogon/sprites/d98f9e5b35e23500bdffdd1237d5482bdee9be49/src/_uncategorized/canonical/trainers/gen3/firered-leafgreen/Oak.png
TRAINERS_URL=https://play.pokemonshowdown.com/sprites/trainers/

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p src/img/sprites src/img/trainers src/img/items

echo "> Pokémon sprites"
git clone -q --filter=blob:none https://github.com/May8th1995/sprites.git "$work/sprites"
git -C "$work/sprites" checkout -q "$SPRITES_COMMIT"
rm -f src/img/sprites/*.png
python3 - "$work/sprites" src/img/sprites <<'EOF'
import os, shutil, sys, unicodedata
src, dst = sys.argv[1], sys.argv[2]
for name in os.listdir(src):
    if name.endswith('.png'):
        shutil.copyfile(os.path.join(src, name), os.path.join(dst, unicodedata.normalize('NFC', name)))
EOF

echo "> Trainer pictures"
rm -f src/img/trainers/*.png
node -e '
const fs = require("fs"), vm = require("vm"), names = new Set();
for (const f of fs.readdirSync("src/js/data/trainer_sprites")) {
	const ctx = {}; vm.runInNewContext(fs.readFileSync("src/js/data/trainer_sprites/" + f, "utf8"), ctx);
	Object.values(ctx.TRAINER_SPRITES).forEach(n => names.add(n));
}
console.log([...names].join("\n"));' | while read -r name; do
	curl -sSfo "src/img/trainers/$name.png" "$TRAINERS_URL$name.png"
done

echo "> Item icons"
rm -f src/img/items/*.png
node -e '
const fs = require("fs"), vm = require("vm"), ctx = {};
vm.runInNewContext(fs.readFileSync("src/js/data/item_icons.js", "utf8"), ctx);
console.log([...new Set(Object.values(ctx.ITEM_ICONS))].join("\n"));' | while read -r file; do
	curl -sSfo "src/img/items/$file" "https://raw.githubusercontent.com/PokeAPI/sprites/$ITEMS_COMMIT/sprites/items/$file"
done

echo "> Professor Oak"
curl -sSfo src/img/oak.png "$OAK_URL"

for dir in sprites trainers items; do echo "src/img/$dir: $(ls src/img/$dir | wc -l) images"; done
du -sh src/img/sprites src/img/trainers src/img/items src/img/oak.png
