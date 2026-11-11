/* Route trainers put where and in the order you meet them, by mode: for a boss fight (its key: name|place|first
 * trainer id; "end" after the last), the route trainers before it as their keys, in order. A trainer listed
 * under a fight comes before it, wherever the calc had placed it (trainer_controls.js's applyTrainerOrderFixes).
 * From players' "Copy order changes" on the Mastersheet. */
var TRAINER_ORDER_FIXES = {
 "normal": {
  "Morty|Lavender Town|52": [
   "Picnicker Heidi|Route 10|156",
   "Pokemaniac Ashton|Rock Tunnel|168",
   "Pokemaniac Winston|Rock Tunnel|166",
   "Picnicker Martha|Rock Tunnel|159",
   "Pokemaniac Steve|Rock Tunnel|165",
   "Hiker Allen|Rock Tunnel|190",
   "Hiker Eric|Rock Tunnel|191",
   "Hiker Lenny|Rock Tunnel|192",
   "Hiker Oliver|Rock Tunnel|193",
   "Hiker Lucas|Rock Tunnel|194",
   "Picnicker Sofia|Rock Tunnel|158",
   "Hiker Dudley|Rock Tunnel|189",
   "Pokemaniac Cooprt|Rock Tunnel|164",
   "Picnicker Leah|Rock Tunnel|476",
   "Picnicker Ariana|Rock Tunnel|475",
   "Picnicker Dana|Rock Tunnel|474",
   "Picnicker Carol|Route 10|157",
   "Hiker Clark|Route 10|187",
   "Hiker Trent|Route 10|188",
   "Pokemaniac Herman|Route 10|163"
  ],
  "Lt. Surge|Vermillion City|416": [
   "Engineer Baily|Vermilion City|220",
   "Sailor Dwayne|Vermilion City|141",
   "Gentleman Tucker|Vermilion City|423"
  ],
  "Brendan|S.S. Anne|50": [
   "Sailor Leonard|S.S. Anne|136",
   "Sailor Duncan|S.S. Anne|137",
   "Sailor Dylan|S.S. Anne|139",
   "Sailor Huey|S.S. Anne|138",
   "Sailor Phillip|S.S. Anne|140",
   "Lass Dawn|S.S. Anne|127"
  ]
 },
 "hardcore": {
  "Picnicker Dana|Rock Tunnel|474": [
   "Picnicker Heidi|Route 10|156",
   "Pokemaniac Ashton|Rock Tunnel|168",
   "Pokemaniac Winston|Rock Tunnel|166",
   "Picnicker Martha|Rock Tunnel|159",
   "Pokemaniac Steve|Rock Tunnel|165",
   "Hiker Allen|Rock Tunnel|190",
   "Hiker Eric|Rock Tunnel|191",
   "Hiker Lenny|Rock Tunnel|192",
   "Hiker Oliver|Rock Tunnel|193",
   "Hiker Lucas|Rock Tunnel|194",
   "Picnicker Sofia|Rock Tunnel|158",
   "Hiker Dudley|Rock Tunnel|189",
   "Pokemaniac Cooprt|Rock Tunnel|164",
   "Picnicker Leah|Rock Tunnel|476",
   "Picnicker Ariana|Rock Tunnel|475"
  ],
  "Maniac Herman|Route 10|163": [
   "Picnicker Carol|Route 10|157",
   "Hiker Clark|Route 10|187",
   "Hiker Trent|Route 10|188"
  ],
  "Gentleman Tucker|Vermillion City Gym|423": [],
  "Brendan|S.S. Anne|50": [
   "Sailor Dylan|S.S. Anne|139",
   "Sailor Phillip|S.S. Anne|140"
  ]
 }
};
