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

import { GameboardActor as ActorViaUmbrella } from 'declarative-hex-worlds';
import { GameboardActor as ActorViaActors } from 'declarative-hex-worlds/actors';
import { GameboardActor as ActorViaTraits } from 'declarative-hex-worlds/traits';

import { IsGameboardTile as TileViaUmbrella } from 'declarative-hex-worlds';
import { IsGameboardTile as TileViaKoota } from 'declarative-hex-worlds/koota';
import { IsGameboardTile as TileViaTraits } from 'declarative-hex-worlds/traits';

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
