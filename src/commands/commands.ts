/**
 * Command planning and execution helpers for renderer selections, actor target
 * commands, command previews, and opt-in gameplay handlers.
 *
 * @module
 */
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
} from '../actors';
import { removeGameboardPlacement } from '../koota';
import {
  MovementAgent,
  findGameboardMovementPath,
  requestGameboardMovement,
  resolveGameboardMovementProfile,
  type GameboardMovementPathRequestOptions,
  type GameboardMovementRequestResult,
} from '../movement';
import type { GameboardNavigationPathResult } from '../navigation';

/**
 * Input accepted by command helpers: either an already planned command or a
 * renderer/gameplay target that should be planned first.
 */
export type GameboardInteractionCommandInput =
  | GameboardInteractionCommand
  | GameboardInteractionTargetInput;

/**
 * Execution outcome for a planned interaction command.
 */
export type GameboardInteractionExecutionStatus =
  | 'handled'
  | 'requested-move'
  | 'requires-game-handler'
  | 'blocked'
  | 'ignored';

/**
 * Result status returned by an opt-in game command handler.
 */
export type GameboardInteractionHandlerStatus = 'handled' | 'blocked' | 'ignored';

/**
 * Serializable metadata returned by command handlers and copied into event
 * records.
 */
export type GameboardInteractionHandlerMetadata = Readonly<
  Record<string, GameboardActorMetadataValue>
>;

/**
 * Serializable side effect emitted by a command handler.
 */
export type GameboardInteractionHandlerEffect =
  | {
      /** Effect discriminator for removing an actor placement. */
      type: 'actor-removed';
      /** Actor id that the handler attempted to remove. */
      actorId: string;
      /** Placement id associated with the removed actor. */
      placementId?: string;
      /** Whether the actor placement was removed. */
      removed: boolean;
      /** Optional failure or diagnostic reason. */
      reason?: string;
    }
  | {
      /** Effect discriminator for removing a non-actor placement. */
      type: 'placement-removed';
      /** Placement id that the handler attempted to remove. */
      placementId: string;
      /** Whether the placement was removed. */
      removed: boolean;
      /** Optional failure or diagnostic reason. */
      reason?: string;
    }
  | {
      /** Effect discriminator for actor metadata updates. */
      type: 'actor-updated';
      /** Actor id that the handler attempted to update. */
      actorId: string;
      /** Placement id associated with the actor. */
      placementId?: string;
      /** Whether actor state was updated. */
      updated: boolean;
      /** Optional failure or diagnostic reason. */
      reason?: string;
    }
  | {
      /** Effect discriminator for placement metadata updates. */
      type: 'placement-updated';
      /** Placement id that the handler attempted to update. */
      placementId: string;
      /** Whether placement state was updated. */
      updated: boolean;
      /** Optional failure or diagnostic reason. */
      reason?: string;
    };

/**
 * Result returned by a game-supplied interaction handler.
 */
export interface GameboardInteractionHandlerResult {
  /** Stable handler id used by event records and simulation reports. */
  handlerId?: string;
  /** Handler outcome. */
  status: GameboardInteractionHandlerStatus;
  /** Optional failure or blocked reason. */
  reason?: string;
  /** Serializable side effects produced by the handler. */
  effects?: readonly GameboardInteractionHandlerEffect[];
  /** Serializable metadata copied into command event records. */
  metadata?: GameboardInteractionHandlerMetadata;
}

/**
 * Context passed to a game-supplied command handler.
 */
export interface GameboardInteractionHandlerContext {
  /** Live Koota world being mutated by the command. */
  world: World;
  /** Planned command being handled. */
  command: GameboardInteractionCommand;
  /** Non-mutating execution preview used to reach this handler. */
  preview: GameboardInteractionCommandPreview;
}

/**
 * Game-supplied handler for commands that require host-specific policy.
 */
export type GameboardInteractionHandler = (
  context: GameboardInteractionHandlerContext
) => GameboardInteractionHandlerResult | undefined;

/**
 * Options for the actor-removal handler preset.
 */
export interface RemoveTargetActorHandlerOptions {
  /** Handler id emitted in event records. */
  handlerId?: string;
  /** Command kinds this handler accepts. */
  commandKinds?: readonly GameboardInteractionCommandKind[];
  /** Require the target to be hostile to the source actor. */
  requireHostile?: boolean;
}

/**
 * Options for the placement-removal handler preset.
 */
export interface RemoveTargetPlacementHandlerOptions {
  /** Handler id emitted in event records. */
  handlerId?: string;
  /** Command kinds this handler accepts. */
  commandKinds?: readonly GameboardInteractionCommandKind[];
  /** Permit actor placements to be removed by this placement handler. */
  includeActorPlacements?: boolean;
}

/**
 * Options for the actor-interaction marker handler preset.
 */
export interface MarkTargetActorInteractedHandlerOptions {
  /** Handler id emitted in event records. */
  handlerId?: string;
  /** Command kinds this handler accepts. */
  commandKinds?: readonly GameboardInteractionCommandKind[];
  /** Metadata field written to the target actor. */
  interactedField?: string;
  /** Metadata field that records the source actor id. */
  sourceActorField?: string;
  /** Extra metadata merged into the target actor. */
  metadata?: GameboardInteractionHandlerMetadata;
}

/**
 * Built-in handler presets for common SimpleRPG-style interactions.
 */
export const GAMEBOARD_INTERACTION_HANDLER_PRESETS = [
  'remove-target-actor',
  'remove-target-placement',
  'mark-target-interacted',
  'default-rpg',
] as const;

/**
 * Identifier for a built-in interaction handler preset.
 */
export type GameboardInteractionHandlerPreset =
  (typeof GAMEBOARD_INTERACTION_HANDLER_PRESETS)[number];

/**
 * Overrides used when expanding a handler preset into concrete handlers.
 */
export interface CreateGameboardInteractionHandlerPresetOptions {
  /** Options for `remove-target-actor`. */
  removeTargetActor?: RemoveTargetActorHandlerOptions;
  /** Options for `remove-target-placement`. */
  removeTargetPlacement?: RemoveTargetPlacementHandlerOptions;
  /** Options for `mark-target-interacted`. */
  markTargetActorInteracted?: MarkTargetActorInteractedHandlerOptions;
}

/**
 * Options for previewing an interaction command without mutating the world.
 */
export interface GameboardInteractionCommandPreviewOptions
  extends GameboardInteractionCommandOptions {
  /** Movement path options used when the command is a move request. */
  movement?: GameboardMovementPathRequestOptions;
}

/**
 * Options for executing a command preview and optionally invoking game handlers.
 */
export interface GameboardInteractionCommandExecutionOptions
  extends GameboardInteractionCommandPreviewOptions {
  /** Handler or handler chain for non-movement interact/attack/inspect commands. */
  handlers?: GameboardInteractionHandler | readonly GameboardInteractionHandler[];
}

/**
 * Options for choosing an actor target and planning a command against it.
 */
export interface GameboardActorTargetCommandOptions extends GameboardActorTargetingOptions {
  /** Require this exact target actor id instead of using the nearest match. */
  targetActorId?: string;
  /** Require the selected actor target to be reachable. Defaults to true. */
  requireReachable?: boolean;
}

/**
 * Non-mutating command plan for a selected actor target.
 */
export interface GameboardActorTargetCommandPlan {
  /** Full actor-targeting report used to select the target. */
  targeting: GameboardActorTargetingReport;
  /** Selected actor target, when one matched. */
  target?: GameboardActorTarget;
  /** Planned command against the selected target. */
  command?: GameboardInteractionCommand;
  /** Whether the command may be executed immediately. */
  canExecute: boolean;
  /** Reason execution is unavailable. */
  reason?: string;
}

/**
 * Non-mutating execution preview for one interaction command.
 */
export interface GameboardInteractionCommandPreview {
  /** Planned command being previewed. */
  command: GameboardInteractionCommand;
  /** Movement path when the command requests movement. */
  movementPath?: GameboardNavigationPathResult;
  /** Movement budget used for range checks. */
  movementBudget?: number;
  /** Whether the command can execute under current rules. */
  canExecute: boolean;
  /** Reason execution is unavailable. */
  reason?: string;
}

/**
 * Result of executing a command preview.
 */
export interface GameboardInteractionCommandExecution {
  /** Planned command that was executed or rejected. */
  command: GameboardInteractionCommand;
  /** Preview result used for execution. */
  preview: GameboardInteractionCommandPreview;
  /** Final execution status. */
  status: GameboardInteractionExecutionStatus;
  /** Movement request created for move commands. */
  movement?: GameboardMovementRequestResult;
  /** Handler result for handler-backed commands. */
  handler?: GameboardInteractionHandlerResult;
  /** Flattened handler side effects. */
  effects?: readonly GameboardInteractionHandlerEffect[];
  /** Reason execution was blocked, ignored, or handler-dependent. */
  reason?: string;
}

/**
 * Koota action bundle for planning, previewing, executing, and targeting
 * interaction commands in a live world.
 */
export const gameboardCommandActions = createActions((world) => ({
  /** Plan a command from a renderer or gameplay target. */
  plan: (
    target: GameboardInteractionTargetInput,
    options: GameboardInteractionCommandOptions = {}
  ) => planGameboardInteractionCommand(world, target, options),
  /** Preview a command without mutating state. */
  preview: (
    commandOrTarget: GameboardInteractionCommandInput,
    options: GameboardInteractionCommandPreviewOptions = {}
  ) => previewGameboardInteractionCommand(world, commandOrTarget, options),
  /** Execute a command with optional host-game handlers. */
  execute: (
    commandOrTarget: GameboardInteractionCommandInput,
    options: GameboardInteractionCommandExecutionOptions = {}
  ) => executeGameboardInteractionCommand(world, commandOrTarget, options),
  /** Select an actor target and plan a command against it. */
  targetCommand: (options: GameboardActorTargetCommandOptions) =>
    planGameboardActorTargetCommand(world, options),
}));

/**
 * Selects an actor target through actor-aware targeting rules and returns the
 * command that would interact with or attack it.
 */
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

/**
 * Previews an interaction command, including actor-aware movement path checks
 * for move commands, without mutating the world.
 */
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

/**
 * Executes a command by requesting movement for move commands or dispatching
 * non-movement commands to game-supplied handlers.
 */
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

/**
 * Creates a handler that removes the target actor for accepted command kinds.
 */
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

/**
 * Creates a handler that removes a target placement for accepted command kinds.
 */
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

/**
 * Creates a handler that marks the target actor as interacted in metadata.
 */
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

/**
 * Expands a named handler preset into concrete interaction handlers.
 */
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

/**
 * Runtime guard for handler preset ids.
 */
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
