import * as calc from '../index';
import {SPECIES} from '../data/species';
import {MOVES} from '../data/moves';
import {TYPE_CHART} from '../data/types';

// Another game's data for a generation (setGameData), on top of that generation's own.
describe('setGameData', () => {
  const species3 = SPECIES[3];
  const moves3 = MOVES[3];
  const types3 = TYPE_CHART[3];
  afterEach(() => calc.setGameData(3, {}));

  test('a Gen 3 game\'s Pokémon, moves, abilities and items', () => {
    const bulbasaur = (SPECIES[3] as any).Bulbasaur;
    calc.setGameData(3, {
      species: {
        Bulbasaur: {...bulbasaur, bs: {...bulbasaur.bs, at: 200}},
        Charmander: null,
        Testmon: {
          types: ['Fire'], bs: {hp: 50, at: 50, df: 50, sa: 50, sd: 50, sp: 50}, weightkg: 1,
        },
      },
      moves: {'Test Beam': {bp: 90, type: 'Fire', category: 'Special'}},
      abilities: ['Test Ability'],
      items: ['Test Orb'],
    });
    const gen3 = calc.Generations.get(3);
    expect(gen3.species.get('bulbasaur' as any)!.baseStats.atk).toBe(200);
    expect(gen3.species.get('charmander' as any)).toBeUndefined();
    expect(gen3.species.get('testmon' as any)!.types).toEqual(['Fire']);
    expect(gen3.moves.get('testbeam' as any)!.basePower).toBe(90);
    expect(gen3.abilities.get('testability' as any)!.name).toBe('Test Ability');
    expect(gen3.items.get('testorb' as any)!.name).toBe('Test Orb');
    expect((calc.SPECIES[3] as any).Testmon).toBeDefined();
    // Gen 9 (Radical Red's) is untouched.
    expect(calc.Generations.get(9).species.get('bulbasaur' as any)!.baseStats.atk).toBe(49);

    // Damage follows the game's data.
    const result = calc.calculate(gen3,
      new calc.Pokemon(gen3, 'Testmon', {level: 50}),
      new calc.Pokemon(gen3, 'Bulbasaur', {level: 50}),
      new calc.Move(gen3, 'Test Beam'));
    expect(result.range()[1]).toBeGreaterThan(0);
  });

  test('builds on the generation\'s own data each time', () => {
    calc.setGameData(3, {species: {Charmander: null}});
    calc.setGameData(3, {});
    expect(calc.Generations.get(3).species.get('charmander' as any)).toBeDefined();
    expect(Object.keys(SPECIES[3])).toHaveLength(Object.keys(species3).length);
    expect(Object.keys(MOVES[3])).toHaveLength(Object.keys(moves3).length);
  });

  test('a Gen 3 game with the Fairy type', () => {
    calc.setGameData(3, {types: {...(TYPE_CHART[6] as any)}});
    expect(calc.Generations.get(3).types.get('fairy' as any)).toBeDefined();
    expect(calc.Generations.get(2).types.get('fairy' as any)).toBeUndefined();
    TYPE_CHART[3] = types3;
  });

  test('a Gen 9 game builds on Gen 9 without Radical Red\'s changes', () => {
    const rr = Object.keys(SPECIES[9]).length;
    calc.setGameData(9, {});
    expect(Object.keys(SPECIES[9]).length).toBeLessThan(rr);
    expect(calc.Generations.get(9).abilities.get('bonezone' as any)).toBeUndefined();
  });
});
