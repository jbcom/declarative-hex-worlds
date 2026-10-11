---
title: Camera framing
description: Fit physical board bounds to a viewport while retaining an authored view direction.
---

`computeCameraFraming` returns a renderer-neutral pose for supplied world-space
bounds. Supply the actual viewport `aspect` (width divided by height) and an
optional `eyeDirection` from the target towards the eye. The direction overrides
the angle preset and is normalized; it does not change the bounds or model scale.

```ts
import { computeCameraFraming } from 'declarative-hex-worlds/camera';

const frame = computeCameraFraming(bounds, {
  angle: 'tilted',
  projection: 'perspective',
  fit: 'frame-board',
  aspect: viewportWidth / viewportHeight,
  eyeDirection: { x: 0, y: 0.49, z: 0.85 },
  fov: 50 * Math.PI / 180,
  padding: 0.1,
});
```

The perspective fit includes each bounds corner's depth as well as its projected
width and height. Orthographic fits return `orthoHalfHeight`; a binding uses
`±orthoHalfHeight` vertically and `±orthoHalfHeight * aspect` horizontally.
With `frame-board`, padding enlarges the projected extents by `1 + padding`.
`fill-viewport` uses no padding, so the governing projected extent meets an edge.

Apply `position` and the returned world-space `up`, look at `target`, then update the renderer's projection and
world matrices. Recompute when the viewport or physical bounds change. FOV is
vertical and in radians here; renderer bindings may require degrees. Bindings
remain responsible for near/far clipping planes.
Orthographic distance places the bounds in front of the eye independently of
viewport aspect; the orthographic volume handles the fit. The returned `up`
also fixes the screen basis at pole views instead of relying on a renderer's
look-at fallback. Older manually constructed framings may omit `up`; bindings
then retain the world-Y default.
The R3F `useCamera` hook drives the active camera's projection kind and measured
viewport aspect, overriding manually supplied values, and waits for a positive
viewport before framing. Configure the active camera type on the canvas.

Aspect defaults to one. The angle presets remain available without a custom
direction. Aspect must be finite and positive, padding finite and nonnegative,
FOV between zero and pi, and a supplied direction finite and nonzero; invalid
values throw `RangeError`. Bounds must have finite coordinates and state must use
supported angle, projection and fit discriminants. A result outside the finite
numeric range also throws `RangeError`. Wait for a nonzero measured viewport
before framing.

`computeBoardBounds` measures tile centers. For a finite physical model, supply
bounds including its footprint, elevated relief and frame rather than assuming
the tile centers include every visible edge.
