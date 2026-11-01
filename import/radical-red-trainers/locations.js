'use strict';
/* The game's places in order, shared by build_trainers.js and rr-rom's route_trainers.js (which walks
 * the maps in this order to put the trainers of a place in the order you meet them). */
// Kanto and the Sevii Islands in the order the game takes you through them (FireRed's), the
// Sevii Islands past Three Island after the Elite Four.
const LOCATION_ORDER = ['Pallet Town', 'Route 1', 'Viridian City', 'Route 22', 'Route 2', 'Viridian Forest',
	'Pewter City', 'Route 3', 'Mt. Moon', 'Route 4', 'Cerulean City', 'Route 24', 'Route 25', 'Route 5',
	'Underground Path', 'Route 6', 'Vermilion City', 'S.S. Anne', 'Route 11', 'Diglett\'s Cave', 'Route 9',
	'Route 10', 'Rock Tunnel', 'Lavender Town', 'Route 8', 'Route 7', 'Celadon City', 'Celadon Dept.',
	'Rocket Hideout', 'Pokémon Tower', 'Saffron City', 'Silph Co.', 'Route 12', 'Route 13', 'Route 14',
	'Route 15', 'Route 16', 'Route 17', 'Route 18', 'Fuchsia City', 'Safari Zone', 'Power Plant',
	'Seafoam Islands', 'Route 19', 'Route 20', 'Cinnabar Island', 'One Island',
	'Kindle Road', 'Treasure Beach', 'Mt. Ember', 'Two Island', 'Cape Brink', 'Three Island', 'Bond Bridge',
	'Berry Forest', 'Three Isle Port', 'Cerulean Cave', 'Pokémon Mansion', 'Route 21', 'Route 23', 'Victory Road',
	'Indigo Plateau', 'Pokémon League', 'Four Island', 'Icefall Cave', 'Five Island', 'Five Isle Meadow',
	'Memorial Pillar', 'Water Labyrinth', 'Resort Gorgeous', 'Lost Cave', 'Rocket Warehouse', 'Six Island',
	'Water Path', 'Ruin Valley', 'Green Path', 'Outcast Island', 'Pattern Bush', 'Altering Cave',
	'Dotted Hole', 'Seven Island', 'Trainer Tower', 'Canyon Entrance', 'Sevault Canyon', 'Tanoby Ruins'];
// The boss documents' names for places, where they are not the game's.
const LOCATION_ALIASES = {
	'Nugget Bridge': 'Route 24', 'Vermillion City': 'Vermilion City', 'Dig House': 'Cerulean City',
	'Game Corner': 'Celadon City', 'Celadon City Hotel': 'Celadon City', 'Pokemon Tower': 'Pokémon Tower',
	'Pokemon Mansion 4f': 'Pokémon Mansion', 'Cinnabar Island Lab': 'Cinnabar Island',
	'Cinnabar Island Gym': 'Cinnabar Island', 'Elite Four': 'Pokémon League', 'Champion': 'Pokémon League',
	'Indigo Plateau': 'Pokémon League',
};

module.exports = {LOCATION_ORDER, LOCATION_ALIASES};
