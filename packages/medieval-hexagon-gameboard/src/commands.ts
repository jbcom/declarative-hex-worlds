import { createActions, type Entity, type World } from 'koota';
import {
  areGameboardActorsHostile,
  createGameboardActorNavigationProfile,
  inspectGameboardActorTargets,
  planGameboardInteractionCommand,
  updateGameboardActor,
  type GameboardActorTarget,
  type GameboardActorTargetingOptions,
  type GameboardActorTargetingReport,
  type GameboardActorMetadataValue,
  type GameboardActorNavigationOptions,
  type GameboardInteractionCommand,
  type GameboardInteractionCommandKind,
  type GameboardInteractionCommandOptions,
  type GameboardInteractionTargetInput,
} from './actors';
import { removeGameboardPlacement } from './koota';
import {
  MovementAgent,
  findGameboardMovementPath,
  requestGameboardMovement,
  resolveGameboardMovementProfile,
  type GameboardMovementPathRequestOptions,
  type GameboardMovementRequestResult,
} from './movement';
import type { GameboardNavigationPathResult } from './navigation';

export type GameboardInteractionCommandInput =
  | GameboardInteractionCommand
  | GameboardInteractionTargetInput;
export type GameboardInteractionExecutionStatus =
  | 'handled'
  | 'requested-move'
  | 'requires-game-handler'
  | 'blocked'
  | 'ignored';

export type GameboardInteractionHandlerStatus = 'handled' | 'blocked' | 'ignored';
export type GameboardInteractionHandlerMetadata = Readonly<
  Record<string, GameboardActorMetadataValue>
>;

export type GameboardInteractionHandlerEffect =
  | {
      type: 'actor-removed';
      actorId: string;
      placementId?: string;
      removed: boolean;
      reason?: string;
    }
  | {
      type: 'placement-removed';
      placementId: string;
      removed: boolean;
      reason?: string;
    }
  | {
      type: 'actor-updated';
      actorId: string;
      placementId?: string;
      updated: boolean;
      reason?: string;
    }
  | {
      type: 'placement-updated';
      placementId: string;
      updated: boolean;
      reason?: string;
    };

export interface GameboardInteractionHandlerResult {
  handlerId?: string;
  status: GameboardInteractionHandlerStatus;
  reason?: string;
  effects?: readonly GameboardInteractionHandlerEffect[];
  metadata?: GameboardInteractionHandlerMetadata;
}

export interface GameboardInteractionHandlerContext {
  world: World;
  command: GameboardInteractionCommand;
  preview: GameboardInteractionCommandPreview;
}

export type GameboardInteractionHandler = (
  context: GameboardInteractionHandlerContext
) => GameboardInteractionHandlerResult | undefined;

export interface RemoveTargetActorHandlerOptions {
  handlerId?: string;
  commandKinds?: readonly GameboardInteractionCommandKind[];
  requireHostile?: boolean;
}

export interface RemoveTargetPlacementHandlerOptions {
  handlerId?: string;
  commandKinds?: readonly GameboardInteractionCommandKind[];
  includeActorPlacements?: boolean;
}

export interface MarkTargetActorInteractedHandlerOptions {
  handlerId?: string;
  commandKinds?: readonly GameboardInteractionCommandKind[];
  interactedField?: string;
  sourceActorField?: string;
  metadata?: GameboardInteractionHandlerMetadata;
}

export const GAMEBOARD_INTERACTION_HANDLER_PRESETS = [
  'remove-target-actor',
  'remove-target-placement',
  'mark-target-interacted',
  'default-rpg',
] as const;

export type GameboardInteractionHandlerPreset =
  (typeof GAMEBOARD_INTERACTION_HANDLER_PRESETS)[number];

export interface CreateGameboardInteractionHandlerPresetOptions {
  removeTargetActor?: RemoveTargetActorHandlerOptions;
  removeTargetPlacement?: RemoveTargetPlacementHandlerOptions;
  markTargetActorInteracted?: MarkTargetActorInteractedHandlerOptions;
}

export interface GameboardInteractionCommandPreviewOptions
  extends GameboardInteractionCommandOptions {
  movement?: GameboardMovementPathRequestOptions;
}

export interface GameboardInteractionCommandExecutionOptions
  extends GameboardInteractionCommandPreviewOptions {
  handlers?: GameboardInteractionHandler | readonly GameboardInteractionHandler[];
}

export interface GameboardActorTargetCommandOptions extends GameboardActorTargetingOptions {
  targetActorId?: string;
  requireReachable?: boolean;
}

export interface GameboardActorTargetCommandPlan {
  targeting: GameboardActorTargetingReport;
  target?: GameboardActorTarget;
  command?: GameboardInteractionCommand;
  canExecute: boolean;
  reason?: string;
}

export interface GameboardInteractionCommandPreview {
  command: GameboardInteractionCommand;
  movementPath?: GameboardNavigationPathResult;
  movementBudget?: number;
  canExecute: boolean;
  reason?: string;
}

export interface GameboardInteractionCommandExecution {
  command: GameboardInteractionCommand;
  preview: GameboardInteractionCommandPreview;
  status: GameboardInteractionExecutionStatus;
  movement?: GameboardMovementRequestResult;
  handler?: GameboardInteractionHandlerResult;
  effects?: readonly GameboardInteractionHandlerEffect[];
  reason?: string;
}

export const gameboardCommandActions = createActions((world) => ({
  plan: (
    target: GameboardInteractionTargetInput,
    options: GameboardInteractionCommandOptions = {}
  ) => planGameboardInteractionCommand(world, target, options),
  preview: (
    commandOrTarget: GameboardInteractionCommandInput,
    options: GameboardInteractionCommandPreviewOptions = {}
  ) => previewGameboardInteractionCommand(world, commandOrTarget, options),
  execute: (
    commandOrTarget: GameboardInteractionCommandInput,
    options: GameboardInteractionCommandExecutionOptions = {}
  ) => executeGameboardInteractionCommand(world, commandOrTarget, options),
  targetCommand: (options: GameboardActorTargetCommandOptions) =>
    planGameboardActorTargetCommand(world, options),
}));

export function planGameboardActorTargetCommand(
  world: World,
  options: GameboardActorTargetCommandOptions
): GameboardActorTargetCommandPlan {
  const { targetActorId, requireReachable = true, ...targetingOptions } = options;
  const targeting = inspectGameboardActorTargets(world, targetingOptions);
  const target = targetActorId
    ? targeting.targets.find((candidate) => candidate.actor.actor.actorId === targetActorId)
    : targeting.nearestTarget;
  const command = target?.command;
  const reason =
    targeting.reason ??
    (!target
      ? targetActorId
        ? `No actor target found for ${targetActorId}`
        : 'No actor target matched the targeting options'
      : requireReachable && !target.reachable
        ? (target.reason ?? `Actor target ${target.actor.actor.actorId} is not reachable`)
        : !command?.canExecute
          ? command?.reason
          : undefined);

  return {
    targeting,
    ...(target ? { target } : {}),
    ...(command ? { command } : {}),
    canExecute: Boolean(command?.canExecute && (!requireReachable || target?.reachable)),
    ...(reason ? { reason } : {}),
  };
}

export function previewGameboardInteractionCommand(
  world: World,
  commandOrTarget: GameboardInteractionCommandInput,
  options: GameboardInteractionCommandPreviewOptions = {}
): GameboardInteractionCommandPreview {
  const command = resolveInteractionCommand(world, commandOrTarget, options);
  if (command.kind !== 'move') {
    return {
      command,
      canExecute: command.canExecute,
      reason: command.reason,
    };
  }

  if (!command.source) {
    return {
      command,
      canExecute: false,
      reason: command.reason ?? 'Move commands require a source actor',
    };
  }
  if (!command.tileKey) {
    return {
      command,
      canExecute: false,
      reason: command.reason ?? 'No target tile',
    };
  }

  const movementOptions = movementOptionsForCommand(world, command, options);
  const movementPath = findGameboardMovementPath(
    world,
    command.source.entity,
    command.tileKey,
    movementOptions
  );
  const movementBudget = movementBudgetFor(command.source.entity, options.movement);
  const outOfRange = movementPath.cost > movementBudget && !options.movement?.allowOutOfRangePath;
  const canExecute = command.canExecute && movementPath.found && !outOfRange;
  return {
    command,
    movementPath,
    movementBudget,
    canExecute,
    reason: canExecute
      ? undefined
      : (command.reason ??
        (!movementPath.found
          ? 'No passable path to destination'
          : outOfRange
            ? `Path costs ${movementPath.cost}; movement budget is ${movementBudget}`
            : undefined)),
  };
}

export function executeGameboardInteractionCommand(
  world: World,
  commandOrTarget: GameboardInteractionCommandInput,
  options: GameboardInteractionCommandExecutionOptions = {}
): GameboardInteractionCommandExecution {
  const preview = previewGameboardInteractionCommand(world, commandOrTarget, options);
  const command = preview.command;
  if (!preview.canExecute) {
    return {
      command,
      preview,
      status: command.kind === 'none' ? 'ignored' : 'blocked',
      reason: preview.reason,
    };
  }

  if (command.kind === 'move' && command.source && command.tileKey) {
    const movement = requestGameboardMovement(
      world,
      command.source.entity,
      command.tileKey,
      movementOptionsForCommand(world, command, options)
    );
    return {
      command,
      preview,
      status:
        movement.state.status === 'ready' || movement.state.status === 'completed'
          ? 'requested-move'
          : 'blocked',
      movement,
      reason: movement.state.reason,
    };
  }

  const handler = executeInteractionHandlers(world, command, preview, options.handlers);
  if (handler) {
    return {
      command,
      preview,
      status: handler.status,
      handler,
      effects: handler.effects ?? [],
      reason: handler.reason,
    };
  }

  return {
    command,
    preview,
    status: 'requires-game-handler',
  };
}

export function createRemoveTargetActorHandler(
  options: RemoveTargetActorHandlerOptions = {}
): GameboardInteractionHandler {
  const commandKinds = new Set(options.commandKinds ?? ['attack-actor']);
  const handlerId = options.handlerId ?? 'remove-target-actor';
  return ({ world, command }) => {
    if (!commandKinds.has(command.kind)) {
      return undefined;
    }
    const target = command.target.actor;
    if (!target) {
      return {
        handlerId,
        status: 'blocked',
        reason: 'No target actor for command',
        effects: [],
      };
    }
    if (options.requireHostile && !isCommandTargetHostile(command, target.actor)) {
      return {
        handlerId,
        status: 'blocked',
        reason: `Target actor ${target.actor.actorId} is not hostile`,
        effects: [],
      };
    }
    const removed = removeGameboardPlacement(world, target.entity);
    const reason = removed ? undefined : `No actor exists with id ${target.actor.actorId}`;
    return {
      handlerId,
      status: removed ? 'handled' : 'blocked',
      reason,
      effects: [
        {
          type: 'actor-removed',
          actorId: target.actor.actorId,
          placementId: target.placement.id,
          removed,
          reason,
        },
      ],
    };
  };
}

export function createRemoveTargetPlacementHandler(
  options: RemoveTargetPlacementHandlerOptions = {}
): GameboardInteractionHandler {
  const commandKinds = new Set(options.commandKinds ?? ['interact-placement']);
  const handlerId = options.handlerId ?? 'remove-target-placement';
  return ({ world, command }) => {
    if (!commandKinds.has(command.kind)) {
      return undefined;
    }
    if (command.target.actor && !options.includeActorPlacements) {
      return undefined;
    }
    const placement = command.target.placement;
    if (!placement) {
      return {
        handlerId,
        status: 'blocked',
        reason: 'No target placement for command',
        effects: [],
      };
    }
    const removed = removeGameboardPlacement(world, command.target.actor?.entity ?? placement.id);
    const reason = removed ? undefined : `No placement exists with id ${placement.id}`;
    return {
      handlerId,
      status: removed ? 'handled' : 'blocked',
      reason,
      effects: [
        {
          type: 'placement-removed',
          placementId: placement.id,
          removed,
          reason,
        },
      ],
    };
  };
}

export function createMarkTargetActorInteractedHandler(
  options: MarkTargetActorInteractedHandlerOptions = {}
): GameboardInteractionHandler {
  const commandKinds = new Set(options.commandKinds ?? ['interact-actor']);
  const handlerId = options.handlerId ?? 'mark-target-interacted';
  const interactedField = options.interactedField ?? 'interacted';
  const sourceActorField = options.sourceActorField ?? 'lastInteractedBy';
  return ({ world, command }) => {
    if (!commandKinds.has(command.kind)) {
      return undefined;
    }
    const target = command.target.actor;
    if (!target) {
      return {
        handlerId,
        status: 'blocked',
        reason: 'No target actor for command',
        effects: [],
      };
    }
    const metadata: GameboardInteractionHandlerMetadata = {
      ...target.actor.metadata,
      [interactedField]: true,
      [sourceActorField]: command.source?.actor.actorId ?? null,
      ...(options.metadata ?? {}),
    };
    updateGameboardActor(world, target.entity, { actorMetadata: metadata });
    return {
      handlerId,
      status: 'handled',
      metadata,
      effects: [
        {
          type: 'actor-updated',
          actorId: target.actor.actorId,
          placementId: target.placement.id,
          updated: true,
        },
      ],
    };
  };
}

export function createGameboardInteractionHandlerPreset(
  preset: GameboardInteractionHandlerPreset,
  options: CreateGameboardInteractionHandlerPresetOptions = {}
): readonly GameboardInteractionHandler[] {
  switch (preset) {
    case 'remove-target-actor':
      return [createRemoveTargetActorHandler(options.removeTargetActor)];
    case 'remove-target-placement':
      return [createRemoveTargetPlacementHandler(options.removeTargetPlacement)];
    case 'mark-target-interacted':
      return [createMarkTargetActorInteractedHandler(options.markTargetActorInteracted)];
    case 'default-rpg':
      return [
        createRemoveTargetActorHandler(options.removeTargetActor),
        createMarkTargetActorInteractedHandler(options.markTargetActorInteracted),
        createRemoveTargetPlacementHandler(options.removeTargetPlacement),
      ];
  }
}

export function isGameboardInteractionHandlerPreset(
  value: unknown
): value is GameboardInteractionHandlerPreset {
  return (
    typeof value === 'string' &&
    (GAMEBOARD_INTERACTION_HANDLER_PRESETS as readonly string[]).includes(value)
  );
}

function resolveInteractionCommand(
  world: World,
  commandOrTarget: GameboardInteractionCommandInput,
  options: GameboardInteractionCommandOptions
): GameboardInteractionCommand {
  return isInteractionCommand(commandOrTarget)
    ? commandOrTarget
    : planGameboardInteractionCommand(world, commandOrTarget, options);
}

function movementOptionsForCommand(
  world: World,
  command: GameboardInteractionCommand,
  options: GameboardInteractionCommandPreviewOptions
): GameboardMovementPathRequestOptions {
  const baseProfile = options.movement?.navigation;
  const navigation = command.source
    ? createGameboardActorNavigationProfile(world, command.source.entity, {
        ...actorNavigationOptions(options),
        baseProfile,
      })
    : baseProfile;
  return {
    ...(options.movement ?? {}),
    navigation,
  };
}

function actorNavigationOptions(
  options: GameboardInteractionCommandOptions
): GameboardActorNavigationOptions {
  return {
    blockingPlacementKinds: options.blockingPlacementKinds,
    blockingPlacementLayers: options.blockingPlacementLayers,
    ignorePlacementIds: options.ignorePlacementIds,
    treatHostileAsBlocking: options.treatHostileAsBlocking,
    treatInteractiveAsBlocking: options.treatInteractiveAsBlocking,
    treatPropsAsBlocking: options.treatPropsAsBlocking,
  };
}

function movementBudgetFor(
  entity: Entity,
  movement: GameboardMovementPathRequestOptions | undefined
): number {
  const agent = entity.get(MovementAgent);
  const profile = resolveGameboardMovementProfile(
    movement?.profile ?? agent?.profileId ?? 'ground',
    movement?.profiles
  );
  return (
    movement?.movementBudget ??
    agent?.remainingMovement ??
    agent?.movementBudget ??
    profile.movementBudget
  );
}

function isInteractionCommand(
  value: GameboardInteractionCommandInput
): value is GameboardInteractionCommand {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<GameboardInteractionCommand>;
  return (
    typeof candidate.kind === 'string' &&
    typeof candidate.intent === 'string' &&
    candidate.target !== undefined
  );
}

function executeInteractionHandlers(
  world: World,
  command: GameboardInteractionCommand,
  preview: GameboardInteractionCommandPreview,
  handlers: GameboardInteractionCommandExecutionOptions['handlers']
): GameboardInteractionHandlerResult | undefined {
  for (const handler of normalizeInteractionHandlers(handlers)) {
    const result = handler({ world, command, preview });
    if (result) {
      return {
        ...result,
        effects: result.effects?.map((effect) => ({ ...effect })) ?? [],
        metadata: result.metadata ? { ...result.metadata } : undefined,
      };
    }
  }
  return undefined;
}

function normalizeInteractionHandlers(
  handlers: GameboardInteractionCommandExecutionOptions['handlers']
): readonly GameboardInteractionHandler[] {
  if (!handlers) {
    return [];
  }
  return typeof handlers === 'function' ? [handlers] : handlers;
}

function isCommandTargetHostile(
  command: GameboardInteractionCommand,
  target: NonNullable<GameboardInteractionCommand['target']['actor']>['actor']
): boolean {
  return command.source ? areGameboardActorsHostile(command.source.actor, target) : target.hostile;
}
