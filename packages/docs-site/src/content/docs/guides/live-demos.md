---
title: Live demos
description: In-browser boards rendered through the declarative-hex-worlds renderer bindings — the docs run the library, they don't just describe it.
---

The signals-and-bindings architecture lets one world drive any renderer. These demos
render the **same** reference example game — a deterministic world compiled from a JSON
scenario into a live Koota runtime — through different renderer bindings, live in your
browser.

## Available demos

- **[Canvas-2D binding →](/demo/canvas2d/)** — the game drawn as 2D sprites through
  `declarative-hex-worlds/canvas2d`. Zero renderer dependency and no downloaded art (the
  sprite sheet is generated procedurally), so it runs anywhere a 2D canvas exists.

## How it works

The core (`declarative-hex-worlds`) is renderer-free: it emits reactive Koota-trait
*signals* — each placement's position, asset, and dimension. A renderer *binding*
subscribes to those signals and reconciles its own scene:

- `declarative-hex-worlds/canvas2d` turns each `{ dimension: '2d' }` placement into a
  sprite blit on a `CanvasRenderingContext2D`.
- `declarative-hex-worlds/three` takes the *same* signals and reconciles a Three.js
  scene for `{ dimension: '3d' }` GLTF models.

Both consume the identical shared game (`@declarative-hex-worlds/examples`), proving the
render seam is genuinely substrate-agnostic. A Pixi binding would be the same shape with
`PIXI.Sprite` in place of `drawImage`.
