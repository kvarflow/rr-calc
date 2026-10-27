import * as I from './interface';

import {Abilities, setGameAbilities} from './abilities';
import {Items, setGameItems} from './items';
import {MoveData, Moves, setGameMoves} from './moves';
import {SpeciesData, Species, setGameSpecies} from './species';
import {TypeChart, Types, setGameTypeChart} from './types';
import {Natures} from './natures';

/**
 * A game's own data (another ROM hack's Pokémon, moves, abilities, items and type chart), for the
 * generation whose mechanics it follows. Pokémon and moves are full records (null takes one out);
 * abilities and items are names added to the generation's own. Radical Red's is gen 9's built-in
 * data, so its pages need none.
 */
export interface GameData {
  species?: {[name: string]: SpeciesData | null};
  moves?: {[name: string]: MoveData | null};
  abilities?: string[];
  items?: string[];
  types?: TypeChart;
}

/**
 * Puts a game's data in place of `gen`'s, on top of that generation's own data (Radical Red's left
 * out). Call it before anything reads the data (a page: right after the calc's scripts load).
 */
export function setGameData(gen: I.GenerationNum, data: GameData) {
  setGameSpecies(gen, data.species || {});
  setGameMoves(gen, data.moves || {});
  setGameAbilities(gen, data.abilities || []);
  setGameItems(gen, data.items || []);
  if (data.types) setGameTypeChart(gen, data.types);
}

export const Generations: I.Generations = new (class {
  get(gen: I.GenerationNum) {
    return new Generation(gen);
  }
})();

class Generation implements I.Generation {
  num: I.GenerationNum;

  abilities: Abilities;
  items: Items;
  moves: Moves;
  species: Species;
  types: Types;
  natures: Natures;

  constructor(num: I.GenerationNum) {
    this.num = num;

    this.abilities = new Abilities(num);
    this.items = new Items(num);
    this.moves = new Moves(num);
    this.species = new Species(num);
    this.types = new Types(num);
    this.natures = new Natures();
  }
}
