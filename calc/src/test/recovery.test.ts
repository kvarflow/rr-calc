import {calculate, Pokemon, Move} from '../index';
import {Generations} from '../data/index';

// Healing from draining moves and Shell Bell comes from the damage dealt: no more than the target
// had left.
describe('Recovery', () => {
  const gen = Generations.get(9);
  test('a draining move against a hurt target heals half of what it had left', () => {
    const attacker = new Pokemon(gen, 'Venusaur', {level: 50, evs: {spa: 252}, nature: 'Modest'});
    const full = new Pokemon(gen, 'Blastoise', {level: 50});
    const hurt = new Pokemon(gen, 'Blastoise', {level: 50, curHP: 20});
    const move = new Move(gen, 'Giga Drain');
    const atFull = calculate(gen, attacker, full, move).recovery().recovery;
    expect(atFull[0]).toBeGreaterThan(10);
    expect(calculate(gen, attacker, hurt, move).recovery().recovery).toEqual([10, 10]);
  });
  test('Big Root boosts what was drained, after the cap', () => {
    const attacker = new Pokemon(gen, 'Venusaur', {level: 50, item: 'Big Root', evs: {spa: 252}});
    const hurt = new Pokemon(gen, 'Blastoise', {level: 50, curHP: 20});
    // Half of the 20 HP left is 10; Big Root makes it 13.
    const result = calculate(gen, attacker, hurt, new Move(gen, 'Giga Drain'));
    expect(result.recovery().recovery).toEqual([13, 13]);
  });
  test('Shell Bell heals an eighth of the damage, up to an eighth of what was left', () => {
    const attacker = new Pokemon(gen, 'Garchomp', {level: 50, item: 'Shell Bell', evs: {atk: 252}});
    const hurt = new Pokemon(gen, 'Pikachu', {level: 50, curHP: 16});
    const result = calculate(gen, attacker, hurt, new Move(gen, 'Earthquake'));
    expect(result.recovery().recovery).toEqual([2, 2]);
  });
});
