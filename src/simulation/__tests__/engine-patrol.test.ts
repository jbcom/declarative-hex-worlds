/**
 * Coverage for createGameboardPatrolSimulationSteps error/warning branches
 * (PRD E0a).
 *
 * The big simulation test exercises happy patrol planning. This file fills
 * the input-validation branches: missing routeId, missing actorId, unknown
 * route, incomplete route under requireFoundRoutes, route with no segments.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
import { createGameboardPatrolSimulationSteps } from '../engine';

// The patrol route shape consumed by createGameboardPatrolSimulationSteps —
// inlined here because the engine's `routes` parameter type is internal.
interface GameboardPatrolPlannedRoute {
  id: string;
  waypointKeys: readonly string[];
  loop: boolean;
  found: boolean;
  segments: readonly unknown[];
  segmentCosts: readonly number[];
}

describe('createGameboardPatrolSimulationSteps validation (PRD E0a)', () => {
  it('reports assignment error when routeId is missing', () => {
    const plan = createGameboardPatrolSimulationSteps({
      routes: [],
      assignments: [
        // biome-ignore lint/suspicious/noExplicitAny: deliberately missing
        { actorId: 'guard-1' } as any,
      ],
    });
    expect(plan.errors.some((e) => e.includes('requires routeId'))).toBe(true);
  });

  it('reports assignment error when actorId is missing', () => {
    const plan = createGameboardPatrolSimulationSteps({
      routes: [],
      assignments: [
        // biome-ignore lint/suspicious/noExplicitAny: deliberately missing
        { routeId: 'route-1' } as any,
      ],
    });
    expect(plan.errors.some((e) => e.includes('requires actorId'))).toBe(true);
  });

  it('reports unknown-route error when routeId references a missing route', () => {
    const plan = createGameboardPatrolSimulationSteps({
      routes: [],
      assignments: [{ routeId: 'unknown-route', actorId: 'guard-1' }],
    });
    expect(plan.errors.some((e) => e.includes('references unknown route'))).toBe(true);
  });

  it('flags incomplete routes under requireFoundRoutes (default true)', () => {
    const route: GameboardPatrolPlannedRoute = {
      id: 'route-1',
      waypointKeys: ['0,0', '1,0'],
      loop: false,
      found: false,
      segments: [],
      segmentCosts: [],
    };
    const plan = createGameboardPatrolSimulationSteps({
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture shape
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture cast for E0a coverage
      routes: [route as any],
      assignments: [{ routeId: 'route-1', actorId: 'guard-1' }],
    });
    expect(plan.errors.some((e) => e.includes('is not complete'))).toBe(true);
  });

  it('warns when a found route has no movement segments', () => {
    const route: GameboardPatrolPlannedRoute = {
      id: 'route-empty',
      waypointKeys: ['0,0'],
      loop: false,
      found: true,
      segments: [],
      segmentCosts: [],
    };
    const plan = createGameboardPatrolSimulationSteps({
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture shape
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture cast for E0a coverage
      routes: [route as any],
      assignments: [{ routeId: 'route-empty', actorId: 'guard-1' }],
    });
    expect(plan.warnings.some((w) => w.includes('has no movement segments'))).toBe(true);
  });

  it('records warnings (not errors) for unfound segments when requireFoundRoutes=false (E0a)', () => {
    const route: GameboardPatrolPlannedRoute = {
      id: 'route-unfound',
      waypointKeys: ['0,0', '1,0'],
      loop: false,
      found: true,
      segments: [
        // biome-ignore lint/suspicious/noExplicitAny: minimal fixture
        { fromIndex: 0, toIndex: 1, fromKey: '0,0', toKey: '1,0', found: false } as any,
      ],
      segmentCosts: [1],
    };
    const plan = createGameboardPatrolSimulationSteps({
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture cast for E0a coverage
      routes: [route as any],
      assignments: [{ routeId: 'route-unfound', actorId: 'guard-1' }],
      requireFoundRoutes: false,
    });
    expect(plan.warnings.some((w) => w.includes('has no passable path'))).toBe(true);
  });

  it('records errors when segment has no destination waypoint and requireFoundRoutes=true (E0a)', () => {
    const route: GameboardPatrolPlannedRoute = {
      id: 'route-no-dest',
      waypointKeys: ['0,0', '1,0'],
      loop: false,
      found: true,
      segments: [
        // biome-ignore lint/suspicious/noExplicitAny: minimal fixture
        { fromIndex: 0, toIndex: 1, fromKey: '0,0', toKey: undefined, found: false } as any,
      ],
      segmentCosts: [1],
    };
    const plan = createGameboardPatrolSimulationSteps({
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture cast for E0a coverage
      routes: [route as any],
      assignments: [{ routeId: 'route-no-dest', actorId: 'guard-1' }],
      requireFoundRoutes: true,
    });
    expect(plan.errors.some((e) => e.includes('has no destination waypoint'))).toBe(true);
  });

  it('records warning when segment has no destination waypoint and requireFoundRoutes=false (E0a)', () => {
    const route: GameboardPatrolPlannedRoute = {
      id: 'route-no-dest-warn',
      waypointKeys: ['0,0', '1,0'],
      loop: false,
      found: true,
      segments: [
        // biome-ignore lint/suspicious/noExplicitAny: minimal fixture
        { fromIndex: 0, toIndex: 1, fromKey: '0,0', toKey: undefined, found: false } as any,
      ],
      segmentCosts: [1],
    };
    const plan = createGameboardPatrolSimulationSteps({
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture cast for E0a coverage
      routes: [route as any],
      assignments: [{ routeId: 'route-no-dest-warn', actorId: 'guard-1' }],
      requireFoundRoutes: false,
    });
    expect(plan.warnings.some((w) => w.includes('has no destination waypoint'))).toBe(true);
  });

  it('records error when segment is not found and requireFoundRoutes=true (E0a)', () => {
    const route: GameboardPatrolPlannedRoute = {
      id: 'route-unfound-strict',
      waypointKeys: ['0,0', '1,0'],
      loop: false,
      found: true,
      segments: [
        // biome-ignore lint/suspicious/noExplicitAny: minimal fixture
        { fromIndex: 0, toIndex: 1, fromKey: '0,0', toKey: '1,0', found: false } as any,
      ],
      segmentCosts: [1],
    };
    const plan = createGameboardPatrolSimulationSteps({
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture cast for E0a coverage
      routes: [route as any],
      assignments: [{ routeId: 'route-unfound-strict', actorId: 'guard-1' }],
      requireFoundRoutes: true,
    });
    expect(plan.errors.some((e) => e.includes('has no passable path'))).toBe(true);
  });

  it('clamps roundCount to >=1 when rounds is undefined or zero', () => {
    const route: GameboardPatrolPlannedRoute = {
      id: 'route-clamp',
      waypointKeys: ['0,0'],
      loop: false,
      found: true,
      segments: [],
      segmentCosts: [],
    };
    const planZero = createGameboardPatrolSimulationSteps({
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture cast for E0a coverage
      routes: [route as any],
      assignments: [{ routeId: 'route-clamp', actorId: 'guard-1', rounds: 0 }],
    });
    expect(planZero.assignments[0]?.roundCount).toBe(1);
    const planNeg = createGameboardPatrolSimulationSteps({
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture cast for E0a coverage
      routes: [route as any],
      // biome-ignore lint/suspicious/noExplicitAny: deliberate negative
      assignments: [{ routeId: 'route-clamp', actorId: 'guard-1', rounds: -3 } as any],
    });
    expect(planNeg.assignments[0]?.roundCount).toBe(1);
  });
});
