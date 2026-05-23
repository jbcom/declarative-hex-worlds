import {
  createActions,
  createQuery,
  trait,
  type Entity,
  type TraitRecord,
  type World,
} from 'koota';
import {
  findGameboardActor,
  type GameboardActorSnapshot,
} from './actors';
import {
  findPlacementEntity,
  IsGameboardPlacement,
  PlacementState,
  type PlacementStateValue,
} from './koota';
import {
  MovementPathState,
  requestGameboardMovement,
  setGameboardMovementAgent,
  type GameboardMovementPathRequestOptions,
  type GameboardMovementRequestResult,
  type MovementPathStateValue,
} from './movement';
import type { GameboardPatrolRoutePlan } from './navigation';

export type GameboardPatrolStatus =
  | 'idle'
  | 'waiting'
  | 'requested'
  | 'moving'
  | 'completed'
  | 'blocked'
  | 'paused';

export interface GameboardPatrolRouteInput {
  id: string;
  waypointKeys: readonly string[];
  loop?: boolean;
  segmentCosts?: readonly number[];
}

export interface SetGameboardPatrolAgentOptions {
  route: GameboardPatrolRoutePlan | GameboardPatrolRouteInput;
  currentWaypointIndex?: number;
  alignToCurrentTile?: boolean;
  active?: boolean;
  pauseTicks?: number;
  movement?: GameboardMovementPathRequestOptions;
}

export interface AdvanceGameboardPatrolOptions {
  movement?: GameboardMovementPathRequestOptions;
  resetMovementBudget?: boolean;
  deactivateOnBlocked?: boolean;
}

export interface GameboardPatrolSnapshot {
  entity: Entity;
  placement: PlacementStateValue;
  actor?: GameboardActorSnapshot;
  agent: GameboardPatrolAgentValue;
  state: GameboardPatrolStateValue;
}

export interface GameboardPatrolAdvanceResult extends GameboardPatrolSnapshot {
  previousState: GameboardPatrolStateValue;
  movement?: GameboardMovementRequestResult;
  requested: boolean;
  advanced: boolean;
}

export const GameboardPatrolAgent = trait({
  routeId: '',
  waypointKeys: () => [] as string[],
  segmentCosts: () => [] as number[],
  loop: true,
  active: true,
  currentWaypointIndex: 0,
  targetWaypointIndex: -1,
  roundsCompleted: 0,
  pauseTicks: 0,
  waitTicksRemaining: 0,
});

export const GameboardPatrolState = trait({
  status: 'idle' as GameboardPatrolStatus,
  targetKey: '',
  reason: undefined as string | undefined,
  lastPathKeys: () => [] as string[],
});

export const IsGameboardPatrolAgent = trait();

export const GameboardPatrolAgentQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsGameboardPatrolAgent,
  GameboardPatrolAgent,
  GameboardPatrolState
);

export type GameboardPatrolAgentValue = TraitRecord<typeof GameboardPatrolAgent>;
export type GameboardPatrolStateValue = TraitRecord<typeof GameboardPatrolState>;

export const gameboardPatrolActions = createActions((world) => ({
  set: (placement: Entity | string, options: SetGameboardPatrolAgentOptions) =>
    setGameboardPatrolAgent(world, placement, options),
  clear: (placement: Entity | string) => clearGameboardPatrolAgent(world, placement),
  advance: (placement: Entity | string, options: AdvanceGameboardPatrolOptions = {}) =>
    advanceGameboardPatrol(world, placement, options),
  run: (options: AdvanceGameboardPatrolOptions = {}) => runGameboardPatrolSystem(world, options),
  read: () => readGameboardPatrolAgents(world),
}));

export function setGameboardPatrolAgent(
  world: World,
  placement: Entity | string,
  options: SetGameboardPatrolAgentOptions
): Entity {
  const entity = requirePatrolPlacementEntity(world, placement);
  const placementState = requirePlacementState(entity);
  const route = normalizePatrolRouteInput(options.route);
  const currentWaypointIndex = resolveCurrentWaypointIndex(route, placementState.tileKey, options);
  const agent = patrolAgentValue({
    routeId: route.id,
    waypointKeys: [...route.waypointKeys],
    segmentCosts: [...(route.segmentCosts ?? [])],
    loop: route.loop ?? true,
    active: options.active ?? true,
    currentWaypointIndex,
    targetWaypointIndex: -1,
    roundsCompleted: 0,
    pauseTicks: Math.max(0, Math.floor(options.pauseTicks ?? 0)),
    waitTicksRemaining: 0,
  });
  entity.add(IsGameboardPatrolAgent);
  if (entity.has(GameboardPatrolAgent)) {
    entity.set(GameboardPatrolAgent, agent);
  } else {
    entity.add(GameboardPatrolAgent(agent));
  }
  if (entity.has(GameboardPatrolState)) {
    entity.set(GameboardPatrolState, idlePatrolState());
  } else {
    entity.add(GameboardPatrolState(idlePatrolState()));
  }
  if (options.movement) {
    setGameboardMovementAgent(world, entity, options.movement);
  }
  return entity;
}

export function clearGameboardPatrolAgent(world: World, placement: Entity | string): Entity {
  const entity = requirePatrolPlacementEntity(world, placement);
  entity.remove(IsGameboardPatrolAgent, GameboardPatrolAgent, GameboardPatrolState);
  return entity;
}

export function readGameboardPatrolAgents(world: World): GameboardPatrolSnapshot[] {
  return world
    .query(GameboardPatrolAgentQuery)
    .map((entity) => patrolSnapshot(world, entity))
    .sort((left, right) => left.agent.routeId.localeCompare(right.agent.routeId) || left.placement.id.localeCompare(right.placement.id));
}

export function advanceGameboardPatrol(
  world: World,
  placement: Entity | string,
  options: AdvanceGameboardPatrolOptions = {}
): GameboardPatrolAdvanceResult {
  const entity = requirePatrolPlacementEntity(world, placement);
  return advancePatrolEntity(world, entity, options);
}

export function runGameboardPatrolSystem(
  world: World,
  options: AdvanceGameboardPatrolOptions = {}
): GameboardPatrolAdvanceResult[] {
  return [...world.query(GameboardPatrolAgentQuery)].map((entity) => advancePatrolEntity(world, entity, options));
}

function advancePatrolEntity(
  world: World,
  entity: Entity,
  options: AdvanceGameboardPatrolOptions
): GameboardPatrolAdvanceResult {
  const previousState = readPatrolState(entity);
  const agent = readPatrolAgent(entity);

  if (!agent.active) {
    const nextState = setPatrolState(entity, { ...previousState, status: 'paused', reason: undefined });
    return patrolResult(world, entity, previousState, nextState, false, false);
  }

  if (agent.waypointKeys.length < 2) {
    const nextAgent = setPatrolAgent(entity, { ...agent, active: false });
    const nextState = setPatrolState(entity, {
      status: 'blocked',
      targetKey: '',
      reason: `Patrol route ${agent.routeId} requires at least two waypoints`,
      lastPathKeys: [],
    });
    return patrolResult(world, entity, previousState, nextState, false, false, undefined, nextAgent);
  }

  const movementState = entity.get(MovementPathState);
  const completedWaypoint = completePatrolWaypointIfNeeded(entity, agent, movementState);
  let nextAgent = completedWaypoint.agent;
  const advanced = completedWaypoint.advanced;

  if (isMovementBlocked(movementState)) {
    const deactivateOnBlocked = options.deactivateOnBlocked ?? true;
    nextAgent = setPatrolAgent(entity, {
      ...nextAgent,
      active: deactivateOnBlocked ? false : nextAgent.active,
    });
    const nextState = setPatrolState(entity, {
      status: 'blocked',
      targetKey: movementState?.destinationKey ?? previousState.targetKey,
      reason: movementState?.reason ?? 'Patrol movement was blocked',
      lastPathKeys: movementState?.pathKeys ?? previousState.lastPathKeys,
    });
    return patrolResult(world, entity, previousState, nextState, false, advanced, undefined, nextAgent);
  }

  if (movementState?.status === 'ready' || movementState?.status === 'moving') {
    const nextState = setPatrolState(entity, {
      status: 'moving',
      targetKey: movementState.destinationKey,
      reason: undefined,
      lastPathKeys: movementState.pathKeys,
    });
    return patrolResult(world, entity, previousState, nextState, false, advanced, undefined, nextAgent);
  }

  if (!nextAgent.active) {
    const nextState = setPatrolState(entity, {
      status: 'completed',
      targetKey: '',
      reason: undefined,
      lastPathKeys: previousState.lastPathKeys,
    });
    return patrolResult(world, entity, previousState, nextState, false, advanced, undefined, nextAgent);
  }

  if (nextAgent.waitTicksRemaining > 0) {
    nextAgent = setPatrolAgent(entity, {
      ...nextAgent,
      waitTicksRemaining: nextAgent.waitTicksRemaining - 1,
    });
    const nextState = setPatrolState(entity, {
      status: 'waiting',
      targetKey: '',
      reason: undefined,
      lastPathKeys: previousState.lastPathKeys,
    });
    return patrolResult(world, entity, previousState, nextState, false, advanced, undefined, nextAgent);
  }

  const targetIndex = nextPatrolWaypointIndex(nextAgent);
  if (targetIndex === undefined) {
    nextAgent = setPatrolAgent(entity, { ...nextAgent, active: false });
    const nextState = setPatrolState(entity, {
      status: 'completed',
      targetKey: '',
      reason: undefined,
      lastPathKeys: previousState.lastPathKeys,
    });
    return patrolResult(world, entity, previousState, nextState, false, advanced, undefined, nextAgent);
  }

  const targetKey = nextAgent.waypointKeys[targetIndex];
  const movementOptions = movementOptionsForPatrol(nextAgent, targetIndex, options);
  if (options.resetMovementBudget ?? true) {
    setGameboardMovementAgent(world, entity, movementOptions);
  }
  const movement = requestGameboardMovement(world, entity, targetKey, movementOptions);
  nextAgent = setPatrolAgent(entity, { ...nextAgent, targetWaypointIndex: targetIndex });
  const requestBlocked = movement.state.status === 'blocked' || movement.state.status === 'out-of-range';
  if (requestBlocked && (options.deactivateOnBlocked ?? true)) {
    nextAgent = setPatrolAgent(entity, { ...nextAgent, active: false });
  }
  const nextState = setPatrolState(entity, {
    status: requestBlocked ? 'blocked' : 'requested',
    targetKey,
    reason: movement.state.reason,
    lastPathKeys: movement.state.pathKeys,
  });

  return patrolResult(world, entity, previousState, nextState, true, advanced, movement, nextAgent);
}

function completePatrolWaypointIfNeeded(
  entity: Entity,
  agent: GameboardPatrolAgentValue,
  movementState: MovementPathStateValue | undefined
): { agent: GameboardPatrolAgentValue; advanced: boolean } {
  if (movementState?.status !== 'completed' || agent.targetWaypointIndex < 0) {
    return { agent, advanced: false };
  }
  const targetIndex = agent.targetWaypointIndex;
  const atRouteEnd = !agent.loop && targetIndex >= agent.waypointKeys.length - 1;
  const wrapped = agent.loop && targetIndex === 0 && agent.currentWaypointIndex === agent.waypointKeys.length - 1;
  return {
    agent: setPatrolAgent(entity, {
      ...agent,
      active: atRouteEnd ? false : agent.active,
      currentWaypointIndex: targetIndex,
      targetWaypointIndex: -1,
      roundsCompleted: agent.roundsCompleted + (wrapped || atRouteEnd ? 1 : 0),
      waitTicksRemaining: atRouteEnd ? 0 : agent.pauseTicks,
    }),
    advanced: true,
  };
}

function movementOptionsForPatrol(
  agent: GameboardPatrolAgentValue,
  targetIndex: number,
  options: AdvanceGameboardPatrolOptions
): GameboardMovementPathRequestOptions {
  const segmentCost = segmentCostFor(agent, targetIndex);
  return {
    ...(options.movement ?? {}),
    allowOutOfRangePath: options.movement?.allowOutOfRangePath ?? true,
    movementBudget: options.movement?.movementBudget ?? segmentCost,
  };
}

function segmentCostFor(agent: GameboardPatrolAgentValue, targetIndex: number): number | undefined {
  const cost =
    targetIndex === 0 && agent.currentWaypointIndex === agent.waypointKeys.length - 1
      ? agent.segmentCosts[agent.currentWaypointIndex]
      : agent.segmentCosts[Math.min(agent.currentWaypointIndex, targetIndex)];
  return Number.isFinite(cost) ? Math.max(1, Math.ceil(cost)) : undefined;
}

function nextPatrolWaypointIndex(agent: GameboardPatrolAgentValue): number | undefined {
  const next = agent.currentWaypointIndex + 1;
  if (next < agent.waypointKeys.length) {
    return next;
  }
  return agent.loop ? 0 : undefined;
}

function resolveCurrentWaypointIndex(
  route: GameboardPatrolRouteInput,
  tileKey: string,
  options: Pick<SetGameboardPatrolAgentOptions, 'currentWaypointIndex' | 'alignToCurrentTile'>
): number {
  if (options.currentWaypointIndex !== undefined) {
    return clampWaypointIndex(options.currentWaypointIndex, route.waypointKeys.length);
  }
  if (options.alignToCurrentTile ?? true) {
    const matchingIndex = route.waypointKeys.indexOf(tileKey);
    if (matchingIndex >= 0) {
      return matchingIndex;
    }
  }
  return 0;
}

function clampWaypointIndex(index: number, waypointCount: number): number {
  if (waypointCount <= 0) {
    return 0;
  }
  return Math.min(waypointCount - 1, Math.max(0, Math.floor(index)));
}

function normalizePatrolRouteInput(route: GameboardPatrolRoutePlan | GameboardPatrolRouteInput): GameboardPatrolRouteInput {
  if ('waypoints' in route) {
    return {
      id: route.id,
      waypointKeys: route.waypoints.map((waypoint) => waypoint.key),
      loop: route.loop,
      segmentCosts: route.segments.map((segment) => segment.cost),
    };
  }
  return {
    id: route.id,
    waypointKeys: [...route.waypointKeys],
    loop: route.loop,
    segmentCosts: [...(route.segmentCosts ?? [])],
  };
}

function isMovementBlocked(movementState: MovementPathStateValue | undefined): boolean {
  return movementState?.status === 'blocked' || movementState?.status === 'out-of-range';
}

function patrolSnapshot(world: World, entity: Entity, agentOverride?: GameboardPatrolAgentValue, stateOverride?: GameboardPatrolStateValue): GameboardPatrolSnapshot {
  return {
    entity,
    placement: requirePlacementState(entity),
    actor: findGameboardActor(world, entity),
    agent: agentOverride ?? readPatrolAgent(entity),
    state: stateOverride ?? readPatrolState(entity),
  };
}

function patrolResult(
  world: World,
  entity: Entity,
  previousState: GameboardPatrolStateValue,
  state: GameboardPatrolStateValue,
  requested: boolean,
  advanced: boolean,
  movement?: GameboardMovementRequestResult,
  agent?: GameboardPatrolAgentValue
): GameboardPatrolAdvanceResult {
  return {
    ...patrolSnapshot(world, entity, agent, state),
    previousState,
    movement,
    requested,
    advanced,
  };
}

function requirePatrolPlacementEntity(world: World, placement: Entity | string): Entity {
  if (typeof placement !== 'string') {
    return placement;
  }
  const actor = findGameboardActor(world, placement);
  const entity = actor?.entity ?? findPlacementEntity(world, placement);
  if (!entity) {
    throw new Error(`No placement or actor exists with id ${placement}`);
  }
  return entity;
}

function requirePlacementState(entity: Entity): PlacementStateValue {
  const state = entity.get(PlacementState);
  if (!state) {
    throw new Error(`Placement entity ${entity.id()} is missing PlacementState`);
  }
  return {
    ...state,
    coordinates: { ...state.coordinates },
    position: { ...state.position },
    metadata: { ...state.metadata },
  };
}

function readPatrolAgent(entity: Entity): GameboardPatrolAgentValue {
  const agent = entity.get(GameboardPatrolAgent);
  if (!agent) {
    throw new Error(`Placement entity ${entity.id()} is missing GameboardPatrolAgent`);
  }
  return patrolAgentValue(agent);
}

function readPatrolState(entity: Entity): GameboardPatrolStateValue {
  const state = entity.get(GameboardPatrolState) ?? idlePatrolState();
  return patrolStateValue(state);
}

function setPatrolAgent(entity: Entity, agent: GameboardPatrolAgentValue): GameboardPatrolAgentValue {
  const value = patrolAgentValue(agent);
  entity.set(GameboardPatrolAgent, value);
  return value;
}

function setPatrolState(entity: Entity, state: GameboardPatrolStateValue): GameboardPatrolStateValue {
  const value = patrolStateValue(state);
  entity.set(GameboardPatrolState, value);
  return value;
}

function patrolAgentValue(value: GameboardPatrolAgentValue): GameboardPatrolAgentValue {
  return {
    ...value,
    waypointKeys: [...value.waypointKeys],
    segmentCosts: [...value.segmentCosts],
  };
}

function patrolStateValue(value: GameboardPatrolStateValue): GameboardPatrolStateValue {
  return {
    ...value,
    lastPathKeys: [...value.lastPathKeys],
  };
}

function idlePatrolState(): GameboardPatrolStateValue {
  return {
    status: 'idle',
    targetKey: '',
    reason: undefined,
    lastPathKeys: [],
  };
}
