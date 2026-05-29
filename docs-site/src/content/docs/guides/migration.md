---
title: Migration Guide
description: How to upgrade between declarative-hex-worlds versions and migrate from the pre-release package name.
sidebar:
  order: 99
---

## From the pre-release scoped package (`@jbcom/medieval-hexagon-gameboard`)

Before the 1.0.0 release, the library was distributed under the internal scoped name
`@jbcom/medieval-hexagon-gameboard`. The public 1.0.0 release renamed it to the unscoped
`declarative-hex-worlds`.

### Step 1 — Update your `package.json` dependency

```diff
- "@jbcom/medieval-hexagon-gameboard": "^0.x.x"
+ "declarative-hex-worlds": "^1.0.0"
```

### Step 2 — Update all import statements

```diff
- import { createGameboard } from '@jbcom/medieval-hexagon-gameboard';
+ import { createGameboard } from 'declarative-hex-worlds';
```

Subpath imports follow the same pattern:

```diff
- import { hexKey } from '@jbcom/medieval-hexagon-gameboard/coordinates';
+ import { hexKey } from 'declarative-hex-worlds/coordinates';
```

### Step 3 — Update the CLI binary name

The CLI binary was also renamed:

```diff
- npx @jbcom/medieval-hexagon-gameboard <command>
+ npx declarative-hex-worlds <command>
```

Or via pnpm exec:

```diff
- pnpm exec medieval-hexagon-gameboard <command>
+ pnpm exec declarative-hex-worlds <command>
```

### Step 4 — Update environment variables

The output jail environment variable was renamed:

```diff
- MEDIEVAL_HEXAGON_OUT_ROOT=/path/to/output
+ HEX_WORLDS_OUT_ROOT=/path/to/output
```

### What did NOT change

- The published API surface — all exported functions, types, and constants are identical.
- The subpath structure — all `/coordinates`, `/gameboard`, `/scenario`, etc. subpaths are preserved.
- The asset format — existing recipe JSON files, scenario files, and manifest files are fully compatible.

## From 1.0.x to 1.1.x

No breaking changes. Patch releases only.

## API versioning policy

Starting from 1.0.0, this package follows [Semantic Versioning](https://semver.org):

- **Patch** (`1.0.x`): bug fixes, documentation, internal optimizations.
- **Minor** (`1.x.0`): new exports, new subpaths, additive API changes.
- **Major** (`x.0.0`): breaking changes to existing exports, removed subpaths, renamed types.

Breaking changes will always be documented here with a concrete migration path before they ship.
