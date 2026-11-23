/*
 * Recommended encounters for each location, in the order you reach them, from the run's Radical Red
 * encounter tracker (Google Sheets, "ENCOUNTER TRACKER", Encounters tab). Shown on the Wild tab
 * (encounters.js): the location's pick is starred, and Plan lists them all.
 *   place: the name shown; key: the Nuzlocke location (an encounter is one per key);
 *   name / area: the wild table (ENCOUNTERS) it is in, if it has one;
 *   pick: the Pokémon ("egg": the Starter Egg, hatched here; "static": any with the Static ability);
 *   how: how or when to find it; note: the sheet's own words.
 * Viridian Forest's Expansion is a location of its own.
 */
var RECOMMENDED_ENCOUNTERS = [
	{place: "Pallet Town", key: "Pallet Town", name: "Pallet Town", pick: "Tentacool", how: "Old Rod"},
	{place: "Route 1", key: "Route 1", name: "Route 1", pick: "Meowth-Galar", how: "at night"},
	{place: "Viridian City", key: "Viridian City", name: "Viridian City", pick: "Marill", how: "Old Rod"},
	{place: "Route 21 (North)", key: "Route 21", name: "Route 21", area: "North", pick: "Wooper-Paldea", how: "at night"},
	{place: "Route 22", key: "Route 22", name: "Route 22", pick: "Psyduck", how: "Old Rod"},
	{place: "Route 2", key: "Route 2", name: "Route 2", pick: "Houndour", how: "at night"},
	{place: "Viridian Forest", key: "Viridian Forest", name: "Viridian Forest", area: "Main", pick: "Kricketot", how: "at night"},
	{place: "Viridian Forest Expansion", key: "Viridian Forest Expansion", name: "Viridian Forest", area: "Expansion", pick: "egg"},
	{place: "Diglett's Cave", key: "Diglett's Cave", name: "Diglett's Cave", area: "North Entrance", pick: "Yamask-Galar", how: "at night"},
	{place: "Pewter City", key: "Pewter City", name: "Pewter City", pick: "Grimer-Alola", how: "at night"},
	{place: "Route 3", key: "Route 3", name: "Route 3", pick: "egg"},
	{place: "Route 4", key: "Route 4", name: "Route 4", pick: "Magikarp", how: "the gift"},
	{place: "Mt. Moon", key: "Mt. Moon", name: "Mt. Moon", pick: "egg"},
	{place: "Cerulean City", key: "Cerulean City", name: "Cerulean City", pick: "egg"},
	{place: "Route 24", key: "Route 24", name: "Route 24", pick: "egg"},
	{place: "Route 25", key: "Route 25", name: "Route 25", pick: "Chinchou", how: "Old Rod"},
	{place: "Route 5", key: "Route 5", name: "Route 5", pick: "Eevee", how: "the gift (the sheet has it as a maybe)"},
	{place: "Underground Path", key: "Underground Path", pick: "egg"},
	{place: "Route 6", key: "Route 6", name: "Route 6", pick: "Shellder", how: "Old Rod"},
	{place: "S.S. Anne", key: "S.S. Anne", name: "S.S. Anne", pick: "Wimpod", how: "Old Rod"},
	{place: "Vermilion City", key: "Vermilion City", name: "Vermilion City", pick: "Frillish", how: "Good Rod"},
	{place: "Route 11", key: "Route 11", name: "Route 11", pick: "Frillish", how: "Good Rod", note: "if not caught in Vermilion City"},
	{place: "Route 9", key: "Route 9", name: "Route 9", pick: "egg"},
	{place: "Route 10", key: "Route 10", name: "Route 10", pick: "static", how: "at night"},
	{place: "Rock Tunnel B1F", key: "Rock Tunnel", name: "Rock Tunnel", area: "B1F", pick: "egg", how: "at night",
		note: "or the Static Pokémon, in case you missed it on Route 10"},
	{place: "Lavender Town", key: "Lavender Town", pick: "egg"},
	{place: "Route 12", key: "Route 12", name: "Route 12", pick: "Spheal", how: "Old Rod"},
	{place: "Route 8", key: "Route 8", name: "Route 8", pick: "egg"},
	{place: "Route 7", key: "Route 7", name: "Route 7", pick: "roamer", note: "Roamer"},
	{place: "Saffron City", key: "Saffron City", pick: "egg"},
	{place: "Route 16", key: "Route 16", name: "Route 16", pick: "egg"},
	{place: "Celadon Dept. Store", key: "Celadon Dept.", pick: "egg"},
	{place: "Rocket Hideout", key: "Rocket Hideout", pick: "egg"},
	{place: "Celadon City", key: "Celadon City", name: "Celadon City", pick: "Dreepy", how: "the gift"},
	{place: "Pokémon Tower (top)", key: "Pokémon Tower", name: "Pokémon Tower", area: "7F", pick: "Rotom", how: "at night"},
	{place: "Silph Co.", key: "Silph Co.", pick: "Lapras", how: "the gift"},
	{place: "Route 17", key: "Route 17", name: "Route 17", pick: "egg"},
	{place: "Route 18", key: "Route 18", name: "Route 18", pick: "roamer", note: "Roamer"},
	{place: "Fuchsia City", key: "Fuchsia City", name: "Fuchsia City", pick: "egg"},
	{place: "Safari Zone (North)", key: "Safari Zone", name: "Safari Zone", area: "North", pick: "Scream Tail", how: "by day"},
	{place: "Route 19", key: "Route 19", name: "Route 19", pick: "Slowpoke", how: "Good Rod"},
	{place: "Route 14", key: "Route 14", name: "Route 14", pick: "roamer", note: "Roamer"},
	{place: "Route 15", key: "Route 15", name: "Route 15", pick: "roamer", note: "Roamer"},
	{place: "Power Plant", key: "Power Plant", name: "Power Plant", pick: "Zapdos", how: "the static encounter"},
	{place: "Route 13", key: "Route 13", name: "Route 13", pick: "Buizel", how: "Surfing"},
	{place: "Cinnabar Island", key: "Cinnabar Island", name: "Cinnabar Island", pick: "egg", note: "or Feebas (Good Rod)"},
	{place: "Seafoam Islands", key: "Seafoam Islands", name: "Seafoam Islands", pick: "egg"},
	{place: "Pokémon Mansion", key: "Pokémon Mansion", name: "Pokémon Mansion", pick: "egg"},
	{place: "Route 20", key: "Route 20", name: "Route 20", pick: "roamer", note: "Roamer (preferred)"},
	{place: "Cerulean Cave (B1F)", key: "Cerulean Cave", name: "Cerulean Cave", area: "B1F", pick: "Feebas", how: "Old Rod"},
	{place: "Route 23", key: "Route 23", name: "Route 23", pick: "egg"},
	{place: "Victory Road", key: "Victory Road", name: "Victory Road", pick: null, note: "WalkinWake = Fraud"}
];

// When the starter eggs come, from the same sheet.
var STARTER_EGG_NOTE = "Get the Starter Egg in Cerulean City and hatch it at the location it is for. " +
	"Egg types on the sheet: Fire [1] just before Lt. Surge and [3] after Koga, Water [2] after the Safari Zone, Grass [4] after Cinnabar.";
