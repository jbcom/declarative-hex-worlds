import { FACTIONS, TEXTURE_SETS, UNIT_STYLES } from './types';
import type { Faction, TextureSet, UnitStyle } from './types';

/** All faction-colored building ids supported across FREE and EXTRA editions. */
export const FACTION_BUILDING_KINDS = [
  'archeryrange',
  'barracks',
  'blacksmith',
  'castle',
  'church',
  'docks',
  'home_A',
  'home_B',
  'lumbermill',
  'market',
  'mine',
  'shipyard',
  'shrine',
  'stables',
  'tavern',
  'tent',
  'townhall',
  'tower_A',
  'tower_B',
  'tower_base',
  'tower_cannon',
  'tower_catapult',
  'watchtower',
  'watermill',
  'well',
  'windmill',
  'workshop',
] as const;

/** Faction-colored building kinds available in the FREE KayKit pack. */
export const FREE_FACTION_BUILDING_KINDS = [
  'archeryrange',
  'barracks',
  'blacksmith',
  'castle',
  'church',
  'home_A',
  'home_B',
  'lumbermill',
  'market',
  'mine',
  'tavern',
  'tower_A',
  'tower_B',
  'tower_base',
  'tower_catapult',
  'watermill',
  'well',
  'windmill',
] as const satisfies readonly FactionBuildingKind[];

/** Faction-colored building kinds expected from the local EXTRA ingest. */
export const EXTRA_FACTION_BUILDING_KINDS = [
  'docks',
  'shipyard',
  'shrine',
  'stables',
  'tent',
  'townhall',
  'tower_cannon',
  'watchtower',
  'workshop',
] as const satisfies readonly FactionBuildingKind[];

/** Neutral structure asset ids available to placement helpers. */
export const NEUTRAL_STRUCTURE_KINDS = [
  'building_bridge_A',
  'building_bridge_B',
  'building_destroyed',
  'building_dirt',
  'building_grain',
  'building_scaffolding',
  'building_stage_A',
  'building_stage_B',
  'building_stage_C',
  'fence_stone_straight',
  'fence_stone_straight_gate',
  'fence_wood_straight',
  'fence_wood_straight_gate',
  'projectile_catapult',
  'wall_corner_A_gate',
  'wall_corner_A_inside',
  'wall_corner_A_outside',
  'wall_corner_B_inside',
  'wall_corner_B_outside',
  'wall_straight',
  'wall_straight_gate',
] as const;

/** Nature and terrain-detail asset ids available to placement helpers. */
export const NATURE_ASSET_IDS = [
  'cloud_big',
  'cloud_small',
  'hill_single_A',
  'hill_single_B',
  'hill_single_C',
  'hills_A',
  'hills_A_trees',
  'hills_B',
  'hills_B_trees',
  'hills_C',
  'hills_C_trees',
  'mountain_A',
  'mountain_A_grass',
  'mountain_A_grass_trees',
  'mountain_B',
  'mountain_B_grass',
  'mountain_B_grass_trees',
  'mountain_C',
  'mountain_C_grass',
  'mountain_C_grass_trees',
  'rock_single_A',
  'rock_single_B',
  'rock_single_C',
  'rock_single_D',
  'rock_single_E',
  'tree_single_A',
  'tree_single_A_cut',
  'tree_single_B',
  'tree_single_B_cut',
  'trees_A_cut',
  'trees_A_large',
  'trees_A_medium',
  'trees_A_small',
  'trees_B_cut',
  'trees_B_large',
  'trees_B_medium',
  'trees_B_small',
  'waterlily_A',
  'waterlily_B',
  'waterplant_A',
  'waterplant_B',
  'waterplant_C',
] as const;

/** All prop asset ids supported across FREE and EXTRA editions. */
export const PROP_ASSET_IDS = [
  'anchor',
  'barrel',
  'boat',
  'boatrack',
  'bucket_arrows',
  'bucket_empty',
  'bucket_water',
  'cannonball_pallet',
  'crate_A_big',
  'crate_A_small',
  'crate_B_big',
  'crate_B_small',
  'crate_long_A',
  'crate_long_B',
  'crate_long_C',
  'crate_long_empty',
  'crate_open',
  'flag_blue',
  'flag_green',
  'flag_red',
  'flag_yellow',
  'haybale',
  'icon_combat',
  'icon_range',
  'ladder',
  'pallet',
  'resource_lumber',
  'resource_stone',
  'sack',
  'target',
  'tent',
  'trough',
  'trough_long',
  'weaponrack',
  'wheelbarrow',
] as const;

/** Prop asset ids available in the FREE KayKit pack. */
export const FREE_PROP_ASSET_IDS = [
  'barrel',
  'bucket_arrows',
  'bucket_empty',
  'bucket_water',
  'crate_A_big',
  'crate_A_small',
  'crate_B_big',
  'crate_B_small',
  'crate_long_A',
  'crate_long_B',
  'crate_long_C',
  'crate_long_empty',
  'crate_open',
  'flag_blue',
  'flag_green',
  'flag_red',
  'flag_yellow',
  'ladder',
  'pallet',
  'resource_lumber',
  'resource_stone',
  'sack',
  'target',
  'tent',
  'weaponrack',
  'wheelbarrow',
] as const satisfies readonly PropAssetId[];

/** Prop asset ids expected from the local EXTRA ingest. */
export const EXTRA_PROP_ASSET_IDS = [
  'anchor',
  'boat',
  'boatrack',
  'cannonball_pallet',
  'haybale',
  'icon_combat',
  'icon_range',
  'trough',
  'trough_long',
] as const satisfies readonly PropAssetId[];

/** Faction-colored unit part ids expected from the local EXTRA ingest. */
export const COLORED_UNIT_PARTS = [
  'banner',
  'bow',
  'cannon',
  'cart',
  'cart_merchant',
  'catapult',
  'helmet',
  'horse',
  'projectile_arrow',
  'shield',
  'ship',
  'spear',
  'sword',
  'unit',
] as const;

/** Neutral unit and equipment part ids expected from the local EXTRA ingest. */
export const NEUTRAL_UNIT_PARTS = [
  'banner',
  'bow',
  'cannon',
  'cart',
  'cart_merchant',
  'catapult',
  'hammer',
  'helmet',
  'horse_A',
  'horse_B',
  'horse_C',
  'horse_D',
  'horse_E',
  'horse_F',
  'horse_G',
  'horse_saddle',
  'projectile_arrow',
  'projectile_cannonball',
  'projectile_catapult',
  'shield',
  'ship',
  'shovel',
  'spear',
  'sword',
  'unit',
] as const;

/** Unit texture application styles available for colored unit parts. */
export const EXTRA_UNIT_STYLES = ['accent', 'full'] as const satisfies readonly UnitStyle[];

/** Any faction building kind supported by catalog helpers. */
export type FactionBuildingKind = (typeof FACTION_BUILDING_KINDS)[number];
/** FREE faction building kind. */
export type FreeFactionBuildingKind = (typeof FREE_FACTION_BUILDING_KINDS)[number];
/** EXTRA-only faction building kind. */
export type ExtraFactionBuildingKind = (typeof EXTRA_FACTION_BUILDING_KINDS)[number];
/** Neutral structure kind. */
export type NeutralStructureKind = (typeof NEUTRAL_STRUCTURE_KINDS)[number];
/** Nature asset id. */
export type NatureAssetId = (typeof NATURE_ASSET_IDS)[number];
/** Prop asset id. */
export type PropAssetId = (typeof PROP_ASSET_IDS)[number];
/** Faction-colored unit part id. */
export type ColoredUnitPart = (typeof COLORED_UNIT_PARTS)[number];
/** Neutral unit part id. */
export type NeutralUnitPart = (typeof NEUTRAL_UNIT_PARTS)[number];
/** Colored unit style id. */
export type ColoredUnitStyle = (typeof EXTRA_UNIT_STYLES)[number];
/** Any unit part id supported by catalog helpers. */
export type UnitPart = ColoredUnitPart | NeutralUnitPart;

/** Builds a faction-colored building asset id. */
export function factionBuildingAssetId(kind: FactionBuildingKind, faction: Faction): string {
  return `building_${kind}_${faction}`;
}

/** Builds a faction-colored unit part asset id. */
export function coloredUnitAssetId(part: ColoredUnitPart, faction: Faction, style: ColoredUnitStyle): string {
  return `${part}_${faction}_${style}`;
}

/** Returns the neutral unit/equipment asset id for a part. */
export function neutralUnitAssetId(part: NeutralUnitPart): string {
  return part;
}

/** Checks whether an asset id belongs to known local-only EXTRA content. */
export function isKnownExtraAssetId(assetId: string): boolean {
  if ((EXTRA_PROP_ASSET_IDS as readonly string[]).includes(assetId)) {
    return true;
  }
  if (assetId === 'hex_transition') {
    return true;
  }
  for (const faction of FACTIONS) {
    for (const kind of EXTRA_FACTION_BUILDING_KINDS) {
      if (assetId === factionBuildingAssetId(kind, faction)) {
        return true;
      }
    }
    for (const part of COLORED_UNIT_PARTS) {
      for (const style of EXTRA_UNIT_STYLES) {
        if (assetId === coloredUnitAssetId(part, faction, style)) {
          return true;
        }
      }
    }
  }
  if ((NEUTRAL_UNIT_PARTS as readonly string[]).includes(assetId)) {
    return !(
      (FREE_PROP_ASSET_IDS as readonly string[]).includes(assetId) ||
      (NEUTRAL_STRUCTURE_KINDS as readonly string[]).includes(assetId) ||
      (NATURE_ASSET_IDS as readonly string[]).includes(assetId)
    );
  }
  return false;
}

/** Builds a faction flag prop asset id. */
export function flagAssetId(faction: Faction): PropAssetId {
  return `flag_${faction}` as PropAssetId;
}

/** Returns the texture filename for a KayKit texture set. */
export function textureFileName(textureSet: TextureSet): string {
  switch (textureSet) {
    case 'fall':
      return 'hexagons_medieval_Fall.png';
    case 'summer':
      return 'hexagons_medieval_Summer.png';
    case 'winter':
      return 'hexagons_medieval_Winter.png';
    case 'default':
      return 'hexagons_medieval.png';
  }
}

/** Type guard for supported faction ids. */
export function isFaction(value: string): value is Faction {
  return (FACTIONS as readonly string[]).includes(value);
}

/** Type guard for supported KayKit texture set ids. */
export function isTextureSet(value: string): value is TextureSet {
  return (TEXTURE_SETS as readonly string[]).includes(value);
}

/** Type guard for supported colored unit styles. */
export function isUnitStyle(value: string): value is UnitStyle {
  return (UNIT_STYLES as readonly string[]).includes(value);
}
