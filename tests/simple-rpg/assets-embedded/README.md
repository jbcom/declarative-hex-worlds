# SimpleRPG embedded assets

This directory is gitignored except for `.gitignore`, `.gitkeep`, and this README.

Local contributors who want to exercise EXTRA-pack flows (add-piece / inject-tile / inject-prop / cross-kit composition) drop the relevant KayKit Adventurers + EXTRA-pack pieces here. Tests that need them are gated behind `MEDIEVAL_HEXAGON_LOCAL_REFERENCES=1` so the default loop stays offline-clean.

This directory ships with no binary content because:

1. EXTRA-pack assets are paid content (itch.io). Committing them violates the license.
2. Even FREE-pack binaries belong in the bootstrap-target, not here. Per PRD §Phase RB, the library is bootstrap-not-bundle.

If a test needs a specific asset and the contributor doesn't have it, the test skips with a clear message. CI never relies on this directory being populated.
