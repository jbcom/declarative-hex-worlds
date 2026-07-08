# Package Notices

The TypeScript source code is MIT licensed.

The included files under `assets/free/` are from KayKit: Medieval Hexagon Pack
1.0 by Kay Lousberg and are distributed under CC0-1.0.

- Kay Lousberg: https://www.kaylousberg.com
- KayKit: https://kaylousberg.itch.io
- CC0-1.0: https://creativecommons.org/publicdomain/zero/1.0/

## Baked cross-maker example assets (RFC0-PACKS)

The `@declarative-hex-worlds/examples` package (not published to npm) bakes a few
tracked pieces from Kenney under CC0-1.0. Credited by courtesy; CC0 requires no
attribution.

- **Kenney Hexagon Kit 2.0** (3D GLB tiles + buildings) — proves cross-maker
  extension: a different asset maker than KayKit composing through the same
  library seams (size normalization + overlay).
- **Kenney Hexagon Pack** (2D sprite tiles: grass/water/sand/dirt/stone) — the
  2D binding's asset story. A 2D canvas cannot consume the library's 3D GLB
  defaults, so the canvas-2D example bakes 2D sprites from this separate CC0
  source (see RFC0-ASSETS-BINDING-SPLIT).

- Kenney: https://www.kenney.nl
- CC0-1.0: https://creativecommons.org/publicdomain/zero/1.0/

## Downloadable default packs (RFC0-10)

These first-class default packs are **not** distributed in this package's npm
tarball or git repository. They are fetched on demand at bootstrap time
(`declarative-hex-worlds bootstrap --pack <id>`) from their upstream GitHub
sources into a consumer-controlled, gitignored asset root. All are by Kay
Lousberg and released under CC0-1.0 (public domain — no attribution required;
credited here by courtesy).

| Pack id | Pack | Role | Upstream |
|---|---|---|---|
| `medieval-hexagon` | KayKit Medieval Hexagon Pack | tiles / terrain | https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 |
| `adventurers` | KayKit Character Pack: Adventurers | models / playable | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 |
| `skeletons` | KayKit Character Pack: Skeletons | models / enemy | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0 |
