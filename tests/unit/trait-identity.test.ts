/**
 * Trait identity gate (PRD E4).
 *
 * Pins the `splitting: true` invariant from PRD §6.7. koota traits are
 * compared by *reference*, not by name. If trait identity drifts across
 * chunks — e.g. two chunks each define their own `GameboardActor` — queries
 * fail silently because the world holds entities under trait A but the
 * query asks for trait B.
 *
 * This test imports the same trait from multiple published subpaths and
 * asserts reference-equality. If `splitting: true` ever silently regresses,
 * this test fires.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';

import { GameboardActor as ActorViaUmbrella } from 'medieval-hexagon-gameboard';
import { GameboardActor as ActorViaActors } from 'medieval-hexagon-gameboard/actors';
import { GameboardActor as ActorViaTraits } from 'medieval-hexagon-gameboard/traits';

import { IsGameboardTile as TileViaUmbrella } from 'medieval-hexagon-gameboard';
import { IsGameboardTile as TileViaKoota } from 'medieval-hexagon-gameboard/koota';
import { IsGameboardTile as TileViaTraits } from 'medieval-hexagon-gameboard/traits';

describe('trait identity across subpaths (PRD E4)', () => {
  it('GameboardActor is the same reference whether imported via umbrella / actors / traits', () => {
    expect(ActorViaActors).toBe(ActorViaUmbrella);
    expect(ActorViaTraits).toBe(ActorViaUmbrella);
  });

  it('IsGameboardTile is the same reference whether imported via umbrella / koota / traits', () => {
    expect(TileViaKoota).toBe(TileViaUmbrella);
    expect(TileViaTraits).toBe(TileViaUmbrella);
  });
});
