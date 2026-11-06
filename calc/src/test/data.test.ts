import {calculate, Pokemon, Move} from '../adaptable';
import * as I from '../data/interface';

import * as calc from '../index';
import {Dex} from '@pkmn/dex';
import {Generations} from './gen';

const pkmn = {Generations: new Generations(Dex)};

const gens = [1, 2, 3, 4, 5, 6, 7, 8, 9] as I.GenerationNum[];

/*
 * Where this calc's tables knowingly differ from Pokémon Showdown's (@pkmn/dex), all inherited from
 * the Radical Red calc this one is built on: Radical Red's Mega Stones from Gen 6 on, the Stick
 * as the Leek, Let's Go's moves and the Cosplay Pikachus kept, and no Gigantamax formes. Gen 9 is
 * compared without Radical Red's own changes (setGameData(9, {})), which are tested elsewhere.
 * Anything else that differs fails.
 */
const RR_MEGA_STONES = ['Alcremite', 'Appletunite', 'Butterfrite', 'Centiskite', 'Coalossite',
  'Copperajite', 'Drednawite', 'Duraludonite', 'Flapplite', 'Garbodorite', 'Kinglerite',
  'Laprasite', 'Machampite', 'Orbeetlite', 'Sandacondite', 'Snorlaxite', 'Toxtricitite',
  'Toxtricitite Low Key'];
const LGPE_MOVES = ['Baddy Bad', 'Bouncy Bubble', 'Buzzy Buzz', 'Freezy Frost', 'Glitzy Glow',
  'Sappy Seed', 'Sizzly Slide', 'Sparkly Swirl', 'Zippy Zap', 'Floaty Fall', 'Pika Papow',
  'Splishy Splash', 'Veevee Volley'];
const COSPLAY_PIKACHU = ['Pikachu-Cosplay', 'Pikachu-Rock-Star', 'Pikachu-Belle', 'Pikachu-PhD',
  'Pikachu-Pop-Star', 'Pikachu-Libre'];

function knownDifferences(kind: string, gen: number) {
  const added: string[] = [];
  const removed: string[] = [];
  if (kind === 'items') {
    if (gen >= 2) removed.push('Stick');
    if (gen >= 6) added.push(...RR_MEGA_STONES);
    if (gen >= 8) added.push('Leek Stick');
  } else if (kind === 'moves') {
    if (gen >= 8) added.push(...LGPE_MOVES);
  } else if (kind === 'species') {
    if (gen >= 7) added.push(...COSPLAY_PIKACHU);
    if (gen >= 8) {
      for (const specie of pkmn.Generations.get(gen as I.GenerationNum).species) {
        if (specie.name.endsWith('-Gmax')) removed.push(specie.name);
      }
    }
  }
  return {added, removed};
}

// Showdown's entry as this calc should have it: no Gigantamax formes among the other formes.
function expectedEntry(kind: string, entry: any) {
  if (kind !== 'species' || !entry.otherFormes) return entry;
  const otherFormes = entry.otherFormes.filter((name: string) => !name.endsWith('-Gmax'));
  const expected = {...entry, otherFormes: otherFormes.length ? otherFormes : undefined};
  if (!otherFormes.length) delete expected.otherFormes;
  return expected;
}

function compareTables(kind: 'abilities' | 'items' | 'moves' | 'species', loose = false) {
  for (const gen of gens) {
    if (gen === 9) calc.setGameData(9, {});
    const {added, removed} = knownDifferences(kind, gen);
    const p = Array.from((pkmn.Generations.get(gen) as any)[kind] as Iterable<any>)
      .filter(entry => !removed.includes(entry.name));
    const c = new Map<I.ID, any>();
    for (const entry of (calc.Generations.get(gen) as any)[kind]) {
      if (!added.includes(entry.name)) c.set(entry.id, entry);
    }

    expect(Array.from(c.values()).map(s => s.name).sort()).toEqual(p.map(s => s.name).sort());
    for (const entry of p) {
      const expected = expectedEntry(kind, entry);
      if (loose) {
        // Formerly toEqual, relax a bit so the calc can have properties aren't in pkmn/dex.
        for (const [k, v] of Object.entries(expected)) {
          if (v === undefined) delete expected[k];
        }
        expect(c.get(entry.id)).toMatchObject(expected);
      } else {
        expect(c.get(entry.id)).toEqual(expected);
      }
      c.delete(entry.id);
    }
    expect(c.size).toBe(0);
  }
}

describe('Generations', () => {
  test('abilities', () => compareTables('abilities'));
  test('items', () => compareTables('items'));
  test('moves', () => compareTables('moves', true));
  test('species', () => compareTables('species'));

  test('types', () => {
    for (const gen of gens) {
      const p = Array.from(pkmn.Generations.get(gen).types);
      const c = new Map<I.ID, I.Type>();
      for (const type of calc.Generations.get(gen).types) c.set(type.id, type);

      expect(Array.from(c.values()).map(s => s.name).sort()).toEqual(p.map(s => s.name).sort());
      for (const type of p) {
        expect(c.get(type.id)).toEqual(type);
        c.delete(type.id);
      }
      expect(c.size).toBe(0);
    }
  });

  test('natures', () => {
    for (const gen of gens) {
      const p = Array.from(pkmn.Generations.get(gen).natures);
      const c = new Map<I.ID, I.Nature>();
      for (const nature of calc.Generations.get(gen).natures) c.set(nature.id, nature);

      expect(Array.from(c.values()).map(s => s.name).sort()).toEqual(p.map(s => s.name).sort());
      for (const nature of p) {
        expect(c.get(nature.id)).toEqual(nature);
        c.delete(nature.id);
      }
      expect(c.size).toBe(0);
    }
  });
});

describe('Adaptable', () => {
  test('usage', () => {
    const gen = pkmn.Generations.get(5);
    const result = calculate(
      gen,
      new Pokemon(gen, 'Gengar', {
        item: 'Choice Specs' as I.ItemName,
        nature: 'Timid',
        evs: {spa: 252},
        boosts: {spa: 1},
      }),
      new Pokemon(gen, 'Chansey', {
        item: 'Eviolite' as I.ItemName,
        nature: 'Calm',
        evs: {hp: 252, spd: 252},
      }),
      new Move(gen, 'Focus Blast')
    );
    expect(result.range()).toEqual([274, 324]);
  });
});
