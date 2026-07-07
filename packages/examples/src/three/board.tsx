/**
 * SimpleRPG board — the declarative render surface (RFC 0001 RFC0-2).
 *
 * The first real consumer of `declarative-hex-worlds/react-elements`: it renders
 * the SimpleRPG runtime through the declarative `<HexWorld>` + `<GameboardObjects>`
 * surface, inside a consumer-owned R3F `<Canvas>` (per the Canvas-ownership design
 * — the game owns the Canvas/camera/lights; dhw owns the board composition + render
 * bridge). This is what proves the element layer works as a real game's board, and
 * is the source of the docs-site live island + visual-verification showcases.
 *
 * @module
 */
import { Canvas } from '@react-three/fiber';
import type { GameboardGltfLoader } from 'declarative-hex-worlds/three';
import { GameboardObjects, HexWorld } from 'declarative-hex-worlds/react-elements';
import type { ReactElement, ReactNode } from 'react';
import { createSimpleRpgRuntime } from '../game/scenario';

/** Props for `<SimpleRpgBoard>`. */
export interface SimpleRpgBoardProps {
  /** GLTF loader for the board's models (the game supplies its asset pipeline). */
  loader: GameboardGltfLoader;
  /** Extra R3F scene content (camera, lights, controls) the game composes around the board. */
  children?: ReactNode;
}

/**
 * Render the SimpleRPG board declaratively. Mounts the scenario runtime in a
 * `<HexWorld>` inside an R3F `<Canvas>`, with `<GameboardObjects>` driving the
 * source-aware render bridge each frame. The game owns the Canvas + camera/lights
 * (passed as `children`); dhw owns the hex board.
 */
export function SimpleRpgBoard({ loader, children }: SimpleRpgBoardProps): ReactElement {
  const runtime = createSimpleRpgRuntime();
  return (
    <Canvas>
      {children}
      <HexWorld runtime={runtime} loader={loader}>
        <GameboardObjects />
      </HexWorld>
    </Canvas>
  );
}
