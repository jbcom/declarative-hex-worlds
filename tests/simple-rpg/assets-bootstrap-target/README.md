# SimpleRPG bootstrap target

This directory is the destination of `bootstrapKayKitAssets({ out: 'tests/simple-rpg/assets-bootstrap-target' })` during SimpleRPG e2e test runs (PRD RS2).

Gitignored except for `.gitignore`, `.gitkeep`, and this README.

Cleared between test runs. Don't put anything here manually; it'll get wiped.

The structure after bootstrap mirrors the upstream KayKit layout:

```
assets-bootstrap-target/
  addons/
    kaykit_medieval_hexagon_pack/
      Assets/
        gltf/
          buildings/...
          decoration/...
          tiles/...
      .bootstrap.json   (integrity sidecar)
```

The integration test asserts that `verifyBootstrap()` reports the sidecar clean after the test's `bootstrapKayKitAssets()` call returns.
