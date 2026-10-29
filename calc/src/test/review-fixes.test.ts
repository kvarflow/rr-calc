import * as calc from '../index';
import {getFlingPower} from '../items';
import {checkMultihitBoost, getModifiedStat} from '../mechanics/util';

// Fixes from a review of the engine, each checked where it went wrong.
describe('review fixes', () => {
  const gen = calc.Generations.get(9);
  const {Pokemon, Move, Field, calculate} = calc;

  test('Barb Barrage doubles against any status, as Radical Red has it', () => {
    const move = new Move(gen, 'Barb Barrage');
    const result = calculate(gen, new Pokemon(gen, 'Qwilfish-Hisui'),
      new Pokemon(gen, 'Snorlax', {status: 'brn'}), move);
    expect(result.rawDesc.moveBP).toBe(move.bp * 2);
  });

  test('Bad Dreams hurts a sleeping target at the end of the turn', () => {
    const result = calculate(gen, new Pokemon(gen, 'Darkrai', {ability: 'Bad Dreams'}),
      new Pokemon(gen, 'Snorlax', {status: 'slp'}), new Move(gen, 'Dark Pulse'));
    expect(result.fullDesc()).toContain('Bad Dreams');
  });

  test('items that fling for 120 fling for 120', () => {
    expect(getFlingPower('TR24')).toBe(120);
  });

  test('frostbite halves every hit of a special multi-hit move', () => {
    const move = () => new Move(gen, 'Water Shuriken', {hits: 2});
    const healthy =
      calculate(gen, new Pokemon(gen, 'Greninja'), new Pokemon(gen, 'Snorlax'), move());
    const frostbitten = calculate(gen, new Pokemon(gen, 'Greninja', {status: 'frz'}),
      new Pokemon(gen, 'Snorlax'), move());
    expect(frostbitten.range()[1] / healthy.range()[1]).toBeLessThan(0.55);
  });

  test('a stat-raising berry works once over a multi-hit move', () => {
    const attacker = new Pokemon(gen, 'Cinccino');
    const defender = new Pokemon(gen, 'Snorlax', {item: 'Kee Berry'});
    const move = new Move(gen, 'Tail Slap');
    const field = new Field();
    const [atkUsed, defUsed] = checkMultihitBoost(gen, attacker, defender, move, field, {} as any);
    checkMultihitBoost(gen, attacker, defender, move, field, {} as any, atkUsed, defUsed);
    expect(defender.boosts.def).toBe(1);
  });

  test('a stat drop between hits uses the attacker\'s own stages', () => {
    const attacker = new Pokemon(gen, 'Salamence');
    const defender = new Pokemon(gen, 'Snorlax', {boosts: {spa: 6}});
    const move = new Move(gen, 'Draco Meteor');
    checkMultihitBoost(gen, attacker, defender, move, new Field(), {} as any);
    expect(attacker.boosts.spa).toBe(-2);
    expect(attacker.stats.spa).toBe(getModifiedStat(attacker.rawStats.spa, -2, gen));
  });

  test('Mega Absol has an ability the game has (Sharpness, its second slot)', () => {
    expect(gen.species.get('absolmega' as any)!.abilities![0]).toBe('Sharpness');
    expect(gen.abilities.get('sharpness' as any)).toBeTruthy();
  });
});
