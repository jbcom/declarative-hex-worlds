import {
  applyTileDeclaration,
  createGameboardBuilder,
  createGameboardPieceRegistry,
  createGameboardRuntime,
  createGameboardWorld,
  createGameboardActorNavigationProfile,
  createHexTileRegistry,
  createSeededGameboardPlan,
  PlacementState,
  classifyGameboardPlacement,
  hexDistance,
  projectWorldToGameboardPlan,
  selectGameboardSpawnLocations,
  spawnGameboardActor,
  validateGameboardPlan,
  validateGameboardRules,
  type GameboardQuestDefinition,
  type GameboardQuestObjectiveProgress,
  type GameboardQuestSnapshot,
  type GameboardPlan,
  type GameboardPlacementKind,
  type GameboardInteractionCommandExecution,
  type GameboardRuntime,
  type HexCoordinates,
  type HexTileRegistry,
} from 'declarative-hex-worlds';
import type { World } from 'koota';

export const SIMPLE_RPG_FIXED_SEED = 'simple-rpg-fixed-v1';
export const SIMPLE_RPG_RANDOM_SEED = 'simple-rpg-seeded-v1';

export type SimpleRpgActorKind = 'player' | 'npc' | 'enemy' | 'prop';
export type SimpleRpgQuestObjectiveStatus = 'pending' | 'completed' | 'blocked';

export interface SimpleRpgActor {
  id: string;
  kind: SimpleRpgActorKind;
  placementId: string;
  tileKey: string;
  blocksMovement: boolean;
  hostile: boolean;
  registeredAs: string;
}

export interface SimpleRpgQuestObjective {
  id: string;
  status: SimpleRpgQuestObjectiveStatus;
  detail: string;
}

export interface SimpleRpgActorTargetCommandResult {
  actorId?: string;
  commandKind?: GameboardInteractionCommandExecution['command']['kind'];
  status?: GameboardInteractionCommandExecution['status'];
  reachable?: boolean;
  reason?: string;
}

export interface SimpleRpgQuestResult {
  completed: boolean;
  finalTileKey: string;
  traversedKeys: readonly string[];
  collisionChecks: readonly SimpleRpgQuestObjective[];
  objectives: readonly SimpleRpgQuestObjective[];
  actorTargetCommand?: SimpleRpgActorTargetCommandResult;
  projectedPlan: GameboardPlan;
}

export interface SimpleRpgGame {
  id: 'fixed' | 'seeded';
  seed: string;
  world: World;
  initialPlan: GameboardPlan;
  registry: HexTileRegistry;
  actors: Map<string, SimpleRpgActor>;
  quest: {
    playerId: string;
    firstNpcId: string;
    secondNpcId: string;
    propId: string;
    enemyId: string;
    finalTileKey: string;
  };
}

const SIMPLE_RPG_REGISTRY = createHexTileRegistry([
  {
    id: 'simple_rpg_safe_grass',
    assetId: 'hex_grass',
    role: 'base',
    terrain: 'grass',
    tags: ['simple-rpg', 'safe-zone'],
    metadata: { game: 'SimpleRPG', role: 'safe-grass' },
  },
  {
    id: 'simple_rpg_quest_road',
    assetId: 'hex_road_A',
    role: 'road',
    edges: { road: [0, 3] },
    tags: ['simple-rpg', 'quest-road'],
    metadata: { game: 'SimpleRPG', role: 'quest-road' },
  },
]);

const SIMPLE_RPG_PIECE_REGISTRY = createGameboardPieceRegistry([
  {
    id: 'simple_rpg_pine_cluster',
    assetId: 'tree_single_A',
    source: 'KayKit Medieval Hexagon FREE',
    role: 'tree',
    requiresExtra: false,
    tags: ['simple-rpg', 'seeded-piece', 'scenery'],
    criteria: {
      terrain: ['grass', 'forest', 'hill'],
      allowOccupied: true,
      maxPerTile: 3,
      prefer: [
        { kind: 'near-terrain', terrain: 'forest', radius: 3, weight: 1 },
        { kind: 'far-from-placement-kind', placementKind: 'structure', radius: 3, weight: 0.4 },
      ],
    },
    metadata: { game: 'SimpleRPG', pieceUse: 'seeded-tree-scatter' },
  },
  {
    id: 'simple_rpg_supply_scatter',
    assetId: 'crate_B_small',
    source: 'KayKit Medieval Hexagon FREE',
    role: 'scatter',
    requiresExtra: false,
    tags: ['simple-rpg', 'seeded-piece', 'loot'],
    criteria: {
      terrain: ['grass', 'road', 'coast'],
      allowOccupied: true,
      maxPerTile: 2,
      prefer: [{ kind: 'near-placement-kind', placementKind: 'structure', radius: 4, weight: 1 }],
    },
    metadata: { game: 'SimpleRPG', pieceUse: 'seeded-supply-scatter' },
  },
  {
    id: 'simple_rpg_waystone',
    assetId: 'flag_yellow',
    source: 'KayKit Medieval Hexagon FREE',
    role: 'landmark',
    requiresExtra: false,
    tags: ['simple-rpg', 'seeded-piece', 'quest-marker'],
    criteria: {
      terrain: ['grass', 'road', 'coast', 'hill'],
      allowOccupied: false,
      edgePadding: 1,
      prefer: [
        { kind: 'center', weight: 0.5 },
        { kind: 'near-placement-kind', placementKind: 'structure', radius: 5, weight: 0.5 },
      ],
    },
    metadata: { game: 'SimpleRPG', pieceUse: 'seeded-waystone' },
  },
]);

export function createFixedSimpleRpgGame(): SimpleRpgGame {
  const registry = SIMPLE_RPG_REGISTRY;
  const builder = createGameboardBuilder({
    seed: SIMPLE_RPG_FIXED_SEED,
    shape: { kind: 'rectangle', width: 8, height: 6 },
  });

  for (let q = 0; q < 8; q += 1) {
    builder.setTerrain({ q, r: 5 }, 'water');
    builder.setCoastEdges({ q, r: 4 }, [1]);
  }

  builder
    .addRoadPath([
      { q: 0, r: 1 },
      { q: 1, r: 1 },
      { q: 2, r: 1 },
      { q: 2, r: 2 },
      { q: 3, r: 2 },
      { q: 4, r: 2 },
      { q: 5, r: 2 },
      { q: 5, r: 3 },
      { q: 6, r: 3 },
      { q: 6, r: 4 },
    ])
    .addRoadPath([
      { q: 3, r: 2 },
      { q: 3, r: 3 },
      { q: 4, r: 3 },
      { q: 5, r: 3 },
    ])
    .addRiverPath(
      [
        { q: 1, r: 0 },
        { q: 1, r: 1 },
        { q: 2, r: 1 },
        { q: 2, r: 2 },
      ],
      { curvy: true, waterless: true }
    )
    .addMountainStack({ at: { q: 7, r: 0 }, height: 2, variant: 'B', withTrees: true })
    .setTileAsset({
      at: { q: 5, r: 0 },
      assetId: 'hex_grass',
      terrain: 'grass',
      textureSet: 'fall',
      tags: ['simple-rpg-overlook'],
    })
    .setElevation({ q: 7, r: 1 }, 1)
    .addHill({ q: 0, r: 3 }, { variant: 'C', withTrees: true })
    .addForest({ q: 1, r: 3 }, { species: 'A', size: 'large' })
    .addHarbor({
      at: { q: 6, r: 4 },
      facing: 1,
      faction: 'blue',
      kind: 'watermill',
      includeProps: false,
    })
    .addFactionBuilding({ at: { q: 6, r: 3 }, faction: 'blue', building: 'market' })
    .addSettlement({ at: { q: 4, r: 0 }, faction: 'blue', building: 'home_A', rotationSteps: 1 })
    .addNeutralStructure({ at: { q: 7, r: 1 }, structure: 'building_grain' })
    .addBridge({ at: { q: 7, r: 4 }, variant: 'A', facing: 1 })
    .addFortification({
      at: { q: 0, r: 0 },
      material: 'wall',
      segment: 'straight',
      enclosureId: 'simple-rpg-town',
    })
    .addConstructionSite({
      at: { q: 7, r: 2 },
      kind: 'stage-B',
      constructionId: 'simple-rpg-works',
    })
    .addSiegeProjectile({
      at: { q: 0, r: 2 },
      kind: 'catapult',
      facing: 2,
      sourceId: 'simple-rpg-town',
    })
    .addElevationRamp({
      at: { q: 7, r: 1 },
      direction: 'up',
      facing: 1,
      fromElevation: 0,
      toElevation: 1,
    })
    .addNature({ at: { q: 7, r: 3 }, assetId: 'rock_single_A' })
    .addFlag({ q: 4, r: 0 }, 'blue', { rotationSteps: 2 })
    .addPropCluster({
      at: { q: 6, r: 0 },
      kind: 'resource-cache',
      density: 0.4,
      facing: 1,
      placement: 'adjacent',
      includeExtra: false,
    })
    .addTransition({ at: { q: 7, r: 3 }, from: 'default', to: 'winter', rotationSteps: 1 })
    .addUnit({ at: { q: 6, r: 0 }, faction: 'blue', part: 'sword', style: 'full' })
    .addUnit({ at: { q: 5, r: 1 }, part: 'hammer', neutral: true, rotationSteps: 3 })
    .addUnitPreset({ at: { q: 6, r: 1 }, faction: 'blue', role: 'soldier', style: 'accent' })
    .scatterDecorations({
      count: 2,
      assets: ['rock_single_B', 'tree_single_B'],
      terrain: ['grass', 'hill', 'forest', 'coast'],
      avoidOccupied: false,
    })
    .addProp({ at: { q: 2, r: 2 }, assetId: 'crate_A_small' });

  applyTileDeclaration(builder, registry, {
    at: { q: 0, r: 1 },
    declaration: 'simple_rpg_safe_grass',
  });
  applyTileDeclaration(builder, registry, {
    at: { q: 3, r: 2 },
    declaration: 'simple_rpg_quest_road',
    metadata: { checkpoint: 'bridge' },
  });

  const plan = builder.build();
  const world = createGameboardWorld(plan);
  const actors = new Map<string, SimpleRpgActor>();
  const player = registerRuntimeActor(world, actors, {
    id: 'player',
    kind: 'player',
    at: { q: 0, r: 1 },
    assetId: 'flag_blue',
    placementKind: 'unit',
    registeredAs: 'controllable-player',
  });
  const firstNpc = registerRuntimeActor(world, actors, {
    id: 'elder',
    kind: 'npc',
    at: { q: 2, r: 1 },
    assetId: 'flag_green',
    placementKind: 'prop',
    registeredAs: 'quest-npc',
  });
  const secondNpc = registerRuntimeActor(world, actors, {
    id: 'harbormaster',
    kind: 'npc',
    at: { q: 5, r: 3 },
    assetId: 'flag_yellow',
    placementKind: 'prop',
    registeredAs: 'quest-npc',
  });
  const prop = registerRuntimeActor(world, actors, {
    id: 'supply-crate',
    kind: 'prop',
    at: { q: 3, r: 2 },
    assetId: 'crate_B_small',
    placementKind: 'prop',
    registeredAs: 'registered-prop',
  });
  const enemy = registerRuntimeActor(world, actors, {
    id: 'bandit',
    kind: 'enemy',
    at: { q: 5, r: 2 },
    assetId: 'flag_red',
    placementKind: 'unit',
    registeredAs: 'registered-enemy',
  });

  return {
    id: 'fixed',
    seed: SIMPLE_RPG_FIXED_SEED,
    world,
    initialPlan: plan,
    registry,
    actors,
    quest: {
      playerId: player.id,
      firstNpcId: firstNpc.id,
      secondNpcId: secondNpc.id,
      propId: prop.id,
      enemyId: enemy.id,
      finalTileKey: secondNpc.tileKey,
    },
  };
}

export function createSeededSimpleRpgGame(seed = SIMPLE_RPG_RANDOM_SEED): SimpleRpgGame {
  const registry = SIMPLE_RPG_REGISTRY;
  const plan = createSeededGameboardPlan({
    seed,
    shape: { kind: 'rectangle', width: 10, height: 8 },
    faction: 'green',
    harborKind: 'watermill',
    mountainStacks: 3,
    forestTiles: 8,
    hillTiles: 4,
    settlements: 4,
    scatterProps: 8,
    layoutDensity: {
      trees: { fill: 0.06, maxCount: 6 },
      rocks: { fill: 0.04, maxCount: 4 },
      props: { fill: 0.03, maxCount: 4 },
      landmarks: { count: 1 },
    },
    pieceRegistry: SIMPLE_RPG_PIECE_REGISTRY,
    pieceFills: [
      {
        selection: { ids: ['simple_rpg_pine_cluster'] },
        count: 4,
        ruleIdPrefix: 'simple-rpg',
        idPrefix: 'simple-rpg:pine',
      },
      {
        selection: { ids: ['simple_rpg_supply_scatter'] },
        count: 3,
        ruleIdPrefix: 'simple-rpg',
        idPrefix: 'simple-rpg:supply',
      },
      {
        selection: { ids: ['simple_rpg_waystone'] },
        count: 1,
        ruleIdPrefix: 'simple-rpg',
        idPrefix: 'simple-rpg:waystone',
      },
    ],
  });
  const world = createGameboardWorld(plan);
  const spawns = selectGameboardSpawnLocations(plan, {
    count: 5,
    seed: `${seed}:actors`,
    minDistance: 2,
    edgePadding: 1,
    maxElevation: 1,
    profile: {
      blockedTerrain: ['water'],
      blockingPlacementKinds: ['structure', 'unit'],
      terrainCosts: { forest: 2, hill: 2, mountain: 4 },
    },
  }).map((spawn) => spawn.coordinates);
  if (spawns.length < 5) {
    throw new Error(`SimpleRPG seeded map ${seed} did not produce enough actor spawn locations`);
  }

  const ordered = [...spawns].sort((left, right) => left.r - right.r || left.q - right.q);
  const playerSpawn = ordered[0];
  if (playerSpawn === undefined) {
    throw new Error(`SimpleRPG seeded map ${seed} produced empty ordered spawn list`);
  }
  const finalNpcSpawn = farthestFrom(playerSpawn, ordered.slice(1));
  const remaining = ordered.filter((coordinates) => key(coordinates) !== key(finalNpcSpawn));
  const firstNpcSpawn = remaining[1] ?? ordered[1];
  const propSpawn = remaining[2] ?? ordered[2];
  const enemySpawn = remaining[3] ?? midpointCandidate(playerSpawn, finalNpcSpawn, ordered);
  if (firstNpcSpawn === undefined || propSpawn === undefined || enemySpawn === undefined) {
    throw new Error(`SimpleRPG seeded map ${seed} produced fewer spawn tiles than required`);
  }
  const actors = new Map<string, SimpleRpgActor>();
  const player = registerRuntimeActor(world, actors, {
    id: 'player',
    kind: 'player',
    at: playerSpawn,
    assetId: 'flag_blue',
    placementKind: 'unit',
    registeredAs: 'controllable-player',
  });
  const firstNpc = registerRuntimeActor(world, actors, {
    id: 'scout',
    kind: 'npc',
    at: firstNpcSpawn,
    assetId: 'flag_green',
    placementKind: 'prop',
    registeredAs: 'quest-npc',
  });
  const secondNpc = registerRuntimeActor(world, actors, {
    id: 'warden',
    kind: 'npc',
    at: finalNpcSpawn,
    assetId: 'flag_yellow',
    placementKind: 'prop',
    registeredAs: 'quest-npc',
  });
  const prop = registerRuntimeActor(world, actors, {
    id: 'field-cache',
    kind: 'prop',
    at: propSpawn,
    assetId: 'crate_A_big',
    placementKind: 'prop',
    registeredAs: 'registered-prop',
  });
  const enemy = registerRuntimeActor(world, actors, {
    id: 'raider',
    kind: 'enemy',
    at: enemySpawn,
    assetId: 'flag_red',
    placementKind: 'unit',
    registeredAs: 'registered-enemy',
  });

  return {
    id: 'seeded',
    seed,
    world,
    initialPlan: plan,
    registry,
    actors,
    quest: {
      playerId: player.id,
      firstNpcId: firstNpc.id,
      secondNpcId: secondNpc.id,
      propId: prop.id,
      enemyId: enemy.id,
      finalTileKey: secondNpc.tileKey,
    },
  };
}

export function runSimpleRpgQuestLine(game: SimpleRpgGame): SimpleRpgQuestResult {
  const runtime = createGameboardRuntime(game.world);
  const player = requireActor(game, game.quest.playerId);
  const firstNpc = requireActor(game, game.quest.firstNpcId);
  const secondNpc = requireActor(game, game.quest.secondNpcId);
  const prop = requireActor(game, game.quest.propId);
  const enemy = requireActor(game, game.quest.enemyId);
  const traversedKeys: string[] = [player.tileKey];
  const questEntity = runtime.spawnQuest(simpleRpgQuestDefinition(game));
  let questSnapshot = runtime.advanceQuest(questEntity);

  runtime.movement.setAgent(player.placementId, { profile: 'worker', movementBudget: 40 });

  const propPath = executeSimpleRpgMove(runtime, player, prop.tileKey);
  questSnapshot = runtime.advanceQuest(questEntity);
  if (propPath.status === 'blocked') {
    return questResultFromSnapshot(runtime, game, traversedKeys, questSnapshot, {
      id: 'registered-prop-passable',
      status: 'blocked',
      detail: propPath.reason ?? `Registered prop ${prop.id} unexpectedly blocked pathing`,
    });
  }
  drainMovement(runtime, traversedKeys);

  const enemyInteraction = runtime.interactActorTarget(
    {
      sourceActor: player.placementId,
      targetActorId: enemy.id,
      hostileToSource: true,
      requireReachable: true,
      maxPathCost: 40,
    },
    { systems: false }
  );
  const enemyCommand = enemyInteraction.dispatch?.execution;
  const enemyTargetCommand = {
    actorId: enemyInteraction.targetCommand.target?.actor.actor.actorId,
    commandKind: enemyInteraction.targetCommand.command?.kind,
    status: enemyCommand?.status,
    reachable: enemyInteraction.targetCommand.target?.reachable,
    reason: enemyInteraction.reason,
  } satisfies SimpleRpgActorTargetCommandResult;
  if (
    !enemyCommand ||
    enemyCommand.status !== 'requires-game-handler' ||
    enemyCommand.command.kind !== 'attack-actor'
  ) {
    return questResultFromSnapshot(
      runtime,
      game,
      traversedKeys,
      questSnapshot,
      {
        id: 'defeat-enemy',
        status: 'blocked',
        detail:
          enemyCommand?.reason ??
          enemyInteraction.reason ??
          `Enemy ${enemy.id} did not produce an attack command`,
      },
      enemyTargetCommand
    );
  }

  const actorNavigation = () =>
    createGameboardActorNavigationProfile(game.world, player.placementId);
  const enemyPath = runtime.movement.requestMove(player.placementId, enemy.tileKey, {
    navigation: actorNavigation(),
  });
  questSnapshot = runtime.advanceQuest(questEntity);
  if (enemyPath.state.status !== 'blocked') {
    return questResultFromSnapshot(runtime, game, traversedKeys, questSnapshot, {
      id: 'registered-enemy-blocks',
      status: 'blocked',
      detail: 'Enemy tile was expected to be blocked before combat resolution',
    });
  }

  runtime.removePlacement(enemy.placementId);
  game.actors.delete(enemy.id);
  questSnapshot = runtime.advanceQuest(questEntity);

  executeSimpleRpgMove(runtime, player, firstNpc.tileKey);
  drainMovement(runtime, traversedKeys);
  questSnapshot = runtime.advanceQuest(questEntity);

  executeSimpleRpgMove(runtime, player, secondNpc.tileKey);
  drainMovement(runtime, traversedKeys);
  questSnapshot = runtime.advanceQuest(questEntity);

  return questResultFromSnapshot(
    runtime,
    game,
    traversedKeys,
    questSnapshot,
    undefined,
    enemyTargetCommand
  );
}

export function classifySimpleRpgPlacement(
  game: SimpleRpgGame,
  placementId: string
): SimpleRpgActorKind | undefined {
  const kind = classifyGameboardPlacement(game.world, placementId);
  return isSimpleRpgActorKind(kind) ? kind : undefined;
}

export function assertSimpleRpgGameValid(game: SimpleRpgGame): void {
  const planViolations = validateGameboardPlan(projectWorldToGameboardPlan(game.world), {
    registry: game.registry,
  });
  const worldViolations = validateGameboardRules(game.world);
  const errors = [...planViolations, ...worldViolations].filter(
    (violation) => violation.severity === 'error'
  );
  if (errors.length > 0) {
    throw new Error(
      errors.map((violation) => `${violation.code}: ${violation.message}`).join('\n')
    );
  }
}

function registerRuntimeActor(
  world: World,
  actors: Map<string, SimpleRpgActor>,
  options: {
    id: string;
    kind: SimpleRpgActorKind;
    at: HexCoordinates;
    assetId: string;
    placementKind: GameboardPlacementKind;
    registeredAs: string;
  }
): SimpleRpgActor {
  const entity = spawnGameboardActor(world, {
    id: `simple-rpg:${options.id}`,
    actorId: options.id,
    actorKind: options.kind,
    team: options.kind === 'enemy' ? 'enemy' : 'allies',
    hostile: options.kind === 'enemy',
    at: options.at,
    assetId: options.assetId,
    kind: options.placementKind,
    layer: options.placementKind === 'unit' ? 'unit' : 'feature',
    elevationOffset: options.placementKind === 'unit' ? 0.08 : 0.05,
    metadata: {
      game: 'SimpleRPG',
      actorId: options.id,
      actorKind: options.kind,
      registeredAs: options.registeredAs,
    },
    actorMetadata: {
      game: 'SimpleRPG',
      registeredAs: options.registeredAs,
    },
  });
  const placement = entity.get(PlacementState);
  if (!placement) {
    throw new Error(`Actor ${options.id} did not receive placement state`);
  }
  const actor: SimpleRpgActor = {
    id: options.id,
    kind: options.kind,
    placementId: placement.id,
    tileKey: placement.tileKey,
    blocksMovement: options.placementKind === 'unit' || options.placementKind === 'structure',
    hostile: options.kind === 'enemy',
    registeredAs: options.registeredAs,
  };
  actors.set(actor.id, actor);
  return actor;
}

function drainMovement(runtime: GameboardRuntime, traversedKeys: string[]): void {
  for (let index = 0; index < 100; index += 1) {
    const results = runtime.tick({
      patrols: false,
      movement: { steps: 1 },
      quests: false,
    }).movement;
    if (results.length === 0) {
      return;
    }
    for (const result of results) {
      if (result.moved) {
        traversedKeys.push(result.placement.tileKey);
      }
    }
    if (
      results.every((result) => result.state.status !== 'ready' && result.state.status !== 'moving')
    ) {
      return;
    }
  }
  throw new Error('SimpleRPG movement did not settle within 100 steps');
}

function executeSimpleRpgMove(
  runtime: GameboardRuntime,
  actor: SimpleRpgActor,
  tileKey: string
): GameboardInteractionCommandExecution {
  return runtime.executeCommand(tileKey, {
    sourceActor: actor.placementId,
  });
}

function questResultFromSnapshot(
  runtime: GameboardRuntime,
  game: SimpleRpgGame,
  traversedKeys: readonly string[],
  quest: GameboardQuestSnapshot,
  override?: SimpleRpgQuestObjective,
  actorTargetCommand?: SimpleRpgActorTargetCommandResult
): SimpleRpgQuestResult {
  const finalTileKey = currentActorTile(runtime, game, game.quest.playerId);
  const collisionChecks = questProgressItems(
    quest,
    ['registered-prop-passable', 'registered-enemy-blocks'],
    override
  );
  const objectives = questProgressItems(
    quest,
    ['defeat-enemy', 'speak-first-npc', 'reach-final-npc'],
    override
  );
  return {
    completed:
      finalTileKey === game.quest.finalTileKey &&
      collisionChecks.every((objective) => objective.status === 'completed') &&
      objectives.every((objective) => objective.status === 'completed'),
    finalTileKey,
    traversedKeys: [...traversedKeys],
    collisionChecks: [...collisionChecks],
    objectives: [...objectives],
    actorTargetCommand,
    projectedPlan: runtime.plan(),
  };
}

function simpleRpgQuestDefinition(game: SimpleRpgGame): GameboardQuestDefinition {
  return {
    id: `simple-rpg:${game.id}:quest`,
    title: 'SimpleRPG Golden Path',
    metadata: {
      game: 'SimpleRPG',
      seed: game.seed,
    },
    objectives: [
      {
        id: 'registered-prop-passable',
        kind: 'collision',
        actor: game.quest.playerId,
        targetActor: game.quest.propId,
        expect: 'can-enter',
      },
      {
        id: 'registered-enemy-blocks',
        kind: 'collision',
        actor: game.quest.playerId,
        targetActor: game.quest.enemyId,
        expect: 'blocked',
      },
      {
        id: 'defeat-enemy',
        kind: 'defeat-actor',
        targetActor: game.quest.enemyId,
      },
      {
        id: 'speak-first-npc',
        kind: 'reach-actor',
        actor: game.quest.playerId,
        targetActor: game.quest.firstNpcId,
      },
      {
        id: 'reach-final-npc',
        kind: 'reach-actor',
        actor: game.quest.playerId,
        targetActor: game.quest.secondNpcId,
      },
    ],
  };
}

function questProgressItems(
  quest: GameboardQuestSnapshot,
  ids: readonly string[],
  override?: SimpleRpgQuestObjective
): SimpleRpgQuestObjective[] {
  const progressById = new Map(
    quest.quest.progress.map((progress) => [progress.objectiveId, progress])
  );
  return ids.map((id) => {
    if (override?.id === id) {
      return override;
    }
    const progress = progressById.get(id);
    return simpleRpgObjectiveFromProgress(id, progress);
  });
}

function simpleRpgObjectiveFromProgress(
  id: string,
  progress: GameboardQuestObjectiveProgress | undefined
): SimpleRpgQuestObjective {
  return {
    id,
    status: progress?.status ?? 'pending',
    detail: progress?.detail ?? 'Pending',
  };
}

function currentActorTile(runtime: GameboardRuntime, game: SimpleRpgGame, actorId: string): string {
  const actor = requireActor(game, actorId);
  const placement = runtime
    .readPlacements()
    .find((candidate) => candidate.id === actor.placementId);
  if (!placement) {
    throw new Error(`Actor ${actorId} placement ${actor.placementId} is missing`);
  }
  actor.tileKey = placement.tileKey;
  return placement.tileKey;
}

function requireActor(game: SimpleRpgGame, actorId: string): SimpleRpgActor {
  const actor = game.actors.get(actorId);
  if (!actor) {
    throw new Error(`Unknown SimpleRPG actor: ${actorId}`);
  }
  return actor;
}

function farthestFrom(
  origin: HexCoordinates,
  candidates: readonly HexCoordinates[]
): HexCoordinates {
  const result = [...candidates].sort(
    (left, right) => hexDistance(right, origin) - hexDistance(left, origin)
  )[0];
  if (result === undefined) {
    throw new Error('farthestFrom requires at least one candidate');
  }
  return result;
}

function midpointCandidate(
  start: HexCoordinates,
  end: HexCoordinates,
  candidates: readonly HexCoordinates[]
): HexCoordinates {
  const midpoint = { q: Math.round((start.q + end.q) / 2), r: Math.round((start.r + end.r) / 2) };
  const result = [...candidates].sort(
    (left, right) => hexDistance(left, midpoint) - hexDistance(right, midpoint)
  )[0];
  if (result === undefined) {
    throw new Error('midpointCandidate requires at least one candidate');
  }
  return result;
}

function key(coordinates: HexCoordinates): string {
  return `${coordinates.q},${coordinates.r}`;
}

function isSimpleRpgActorKind(kind: string | undefined): kind is SimpleRpgActorKind {
  return kind === 'player' || kind === 'npc' || kind === 'enemy' || kind === 'prop';
}
