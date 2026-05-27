# `tests/e2e/simple-rpg/`

End-to-end playwright harness for the SimpleRPG test driver. The directory
exists as a skeleton for PRD `RS1`-`RS3` — those items flesh it out with:

- `simple-rpg-ci.test.ts` — exercises `bootstrap --source github` against the
  live KayKit FREE repo. CI-scheduled (not per-PR; rate-limit guarded).
- `simple-rpg-local-extra.test.ts` — exercises `bootstrap --source zip --zip
  references/...EXTRA.zip` for the EXTRA-pack flows. Gated by
  `MEDIEVAL_HEXAGON_LOCAL_REFERENCES=1`.

Until `RS1`-`RS3` land, the unit-level SimpleRPG fixture (consumed by the
CLI's release-readiness coverage gate, the interop coverage test, and the
browser visual snapshots) lives at `tests/integration/simple-rpg/`.

See `.agent-state/directive.md` Phase RS for the full plan.
