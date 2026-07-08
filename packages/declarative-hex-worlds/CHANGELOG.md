# Changelog

All notable changes to `declarative-hex-worlds` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

From version 1.0.0 onward, release-please populates this file from Conventional Commits on `main`. Pre-1.0 entries below are summarized from git history.

## [1.1.1](https://github.com/jbcom/declarative-hex-worlds/compare/declarative-hex-worlds@1.1.0...declarative-hex-worlds@1.1.1) (2026-07-08)


### Bug Fixes

* **ci:** publish job — run playwright install through its package (1.1.0 never published) ([#223](https://github.com/jbcom/declarative-hex-worlds/issues/223)) ([a3a4f1e](https://github.com/jbcom/declarative-hex-worlds/commit/a3a4f1ee872708b30bbe11e8f9cb4a63beb639d0))
* **ci:** release bootstrap --out models (was doubled path, 404'd coverage GLTFs) ([#225](https://github.com/jbcom/declarative-hex-worlds/issues/225)) ([be6064c](https://github.com/jbcom/declarative-hex-worlds/commit/be6064cb26597bb75aa32928002549aab32c2f5f))

## [1.1.0](https://github.com/jbcom/declarative-hex-worlds/compare/declarative-hex-worlds@1.0.2...declarative-hex-worlds@1.1.0) (2026-07-08)


### Features

* generic asset sources + first-class consumer package (RFC 0001) ([#220](https://github.com/jbcom/declarative-hex-worlds/issues/220)) ([2eb4571](https://github.com/jbcom/declarative-hex-worlds/commit/2eb4571ffbf9dedb620a8f5cb7044e5056ee7e42))
* real asset provisioning — scan-derived pack layout, pack classifiers, showcase pillars, 2D sprites ([#222](https://github.com/jbcom/declarative-hex-worlds/issues/222)) ([6763589](https://github.com/jbcom/declarative-hex-worlds/commit/6763589fd3af9ee191c51b319f4be4dfa83e6469))

## [1.0.2](https://github.com/jbcom/declarative-hex-worlds/compare/declarative-hex-worlds@1.0.1...declarative-hex-worlds@1.0.2) (2026-07-06)


### Bug Fixes

* stabilize source cli help import ([#101](https://github.com/jbcom/declarative-hex-worlds/issues/101)) ([802f0e8](https://github.com/jbcom/declarative-hex-worlds/commit/802f0e8e585982362007acd5a2bcf6047c025c25))
* wire browser-free coverage gate ([c6143f5](https://github.com/jbcom/declarative-hex-worlds/commit/c6143f546ebda3dba0001d93743396b41056e848))


### Refactoring

* split gameboard navigation planners ([#104](https://github.com/jbcom/declarative-hex-worlds/issues/104)) ([4c6f04e](https://github.com/jbcom/declarative-hex-worlds/commit/4c6f04e29215063b5d669975eddf69e7c60c7811))
* split gameboard terrain construction ([#103](https://github.com/jbcom/declarative-hex-worlds/issues/103)) ([5302a48](https://github.com/jbcom/declarative-hex-worlds/commit/5302a48fc4a2e5e21b11c24d9b6dde948e6055cf))
* split scenario catalog data builders ([#105](https://github.com/jbcom/declarative-hex-worlds/issues/105)) ([7dce5ed](https://github.com/jbcom/declarative-hex-worlds/commit/7dce5ed0c33f27af288b2d75ba034bd2d784366d))
* split systems command and tick boundaries ([#102](https://github.com/jbcom/declarative-hex-worlds/issues/102)) ([22777cb](https://github.com/jbcom/declarative-hex-worlds/commit/22777cb2f654262632eef4938c6614a9f0d6fbbd))

## [1.0.1](https://github.com/jbcom/declarative-hex-worlds/compare/declarative-hex-worlds@1.0.0...declarative-hex-worlds@1.0.1) (2026-06-24)


### Bug Fixes

* CR-P0 critical blockers — peer deps, release pin, readJson safety, coverage CI ([#62](https://github.com/jbcom/declarative-hex-worlds/issues/62)) ([038d850](https://github.com/jbcom/declarative-hex-worlds/commit/038d8501476b20fbe1ba92ea7986d162b0f08c46))
* hash bootstrap files through pipeline ([#95](https://github.com/jbcom/declarative-hex-worlds/issues/95)) ([2d52fc5](https://github.com/jbcom/declarative-hex-worlds/commit/2d52fc51f61ef250ca58c8c7718768f00ec94eeb))
* **security,ci:** CR-P0-4 bootstrap security tests + CR-P1-3/7/8/9/10 hardening batch ([#64](https://github.com/jbcom/declarative-hex-worlds/issues/64)) ([dcfba17](https://github.com/jbcom/declarative-hex-worlds/commit/dcfba17e1475a53cb054fb218e6a2bd7c42035bd))


### Performance

* **gameboard/systems:** eliminate query spreads + Map default-arg allocations (CR-P2-2, CR-P2-3) ([#69](https://github.com/jbcom/declarative-hex-worlds/issues/69)) ([c416c09](https://github.com/jbcom/declarative-hex-worlds/commit/c416c09444051e9cba9946c470729a6e0cf17332))
* **koota+catalog:** O(1) entity lookup + isKnownExtraAssetId set (CR-P1-4, CR-P1-5) ([#67](https://github.com/jbcom/declarative-hex-worlds/issues/67)) ([7a6c2a5](https://github.com/jbcom/declarative-hex-worlds/commit/7a6c2a5f70b832d00209a2487be7dc0f2b56c7d8))
* **pathfinding:** O(log N) binary min-heap A* + Dijkstra (CR-P1-1) ([#65](https://github.com/jbcom/declarative-hex-worlds/issues/65)) ([f12210c](https://github.com/jbcom/declarative-hex-worlds/commit/f12210ce590c68c8254913f66f1634c49fe5505e))
* **react:** fast path empty selector options ([#86](https://github.com/jbcom/declarative-hex-worlds/issues/86)) ([1ffcb76](https://github.com/jbcom/declarative-hex-worlds/commit/1ffcb76467f3060a8b4e155c0f498371e7f3773a))


### Refactoring

* **cli:** decompose _shared.ts into per-command files (CR-P2-1) ([#68](https://github.com/jbcom/declarative-hex-worlds/issues/68)) ([86444aa](https://github.com/jbcom/declarative-hex-worlds/commit/86444aa3bd4add14303c03a7439c59893c07ecdd))
* **gameboard:** split plan contracts ([#99](https://github.com/jbcom/declarative-hex-worlds/issues/99)) ([65b735c](https://github.com/jbcom/declarative-hex-worlds/commit/65b735cfeceff64a9ed3970ffed6aa1ba2fb9978))
* **guides:** invert simple-rpg guide production→test import (CR-P1-2) ([#66](https://github.com/jbcom/declarative-hex-worlds/issues/66)) ([1340074](https://github.com/jbcom/declarative-hex-worlds/commit/134007451d2e15182b3ef538d76ae414c2ab9c5c))
* expose screenshot artifacts via interop barrel ([#93](https://github.com/jbcom/declarative-hex-worlds/issues/93)) ([bd4d484](https://github.com/jbcom/declarative-hex-worlds/commit/bd4d484c8c2c32c93278afc7a9f133204ff4fa3b))
* split patrol advance state machine ([#94](https://github.com/jbcom/declarative-hex-worlds/issues/94)) ([2634fe4](https://github.com/jbcom/declarative-hex-worlds/commit/2634fe44defd69c36e954f0937c948426e3719a2))
* collapse simulation barrel shim ([#96](https://github.com/jbcom/declarative-hex-worlds/issues/96)) ([339d0d6](https://github.com/jbcom/declarative-hex-worlds/commit/339d0d614e7d0f80d2792f7adc950e072ca8cd8))
* **koota:** require explicit extra asset flags ([#83](https://github.com/jbcom/declarative-hex-worlds/issues/83)) ([e98c14e](https://github.com/jbcom/declarative-hex-worlds/commit/e98c14ec520bee910a13403cd319c8faaa6a5f0e))
* **simulation:** split script types and validators ([#85](https://github.com/jbcom/declarative-hex-worlds/issues/85)) ([7d93e17](https://github.com/jbcom/declarative-hex-worlds/commit/7d93e1786c0d05c391995d566d84aeeb3ebb0092))
* **systems:** split event snapshots ([#100](https://github.com/jbcom/declarative-hex-worlds/issues/100)) ([2c48ba6](https://github.com/jbcom/declarative-hex-worlds/commit/2c48ba673486a70e282578a351f4b6c34f4b1525))

## 1.0.0 (2026-05-28)

### Package rename

The package was published under the name **`declarative-hex-worlds`** starting with this release.
Previous development builds used a scoped internal name (`@jbcom/medieval-hexagon-gameboard`).
See the [migration guide](/guides/migration/) for rename impact and upgrade steps.

### Features

* 1.0 stabilization phase 2 (PR [#4](https://github.com/jbcom/declarative-hex-worlds/issues/4)) ([14c5f77](https://github.com/jbcom/declarative-hex-worlds/commit/14c5f77b652f985582d8aad4167d5566b577952b))
* E0 coverage batch-10 ([#20](https://github.com/jbcom/declarative-hex-worlds/issues/20)) ([a4c2c83](https://github.com/jbcom/declarative-hex-worlds/commit/a4c2c8384667e926adef04970e26e61871f21234))
* E0 coverage batch-11 ([#21](https://github.com/jbcom/declarative-hex-worlds/issues/21)) ([4770638](https://github.com/jbcom/declarative-hex-worlds/commit/477063862b05333b8e7f8740fad21d0058bf3de2))
* E0 coverage batch-12 ([#22](https://github.com/jbcom/declarative-hex-worlds/issues/22)) ([392697b](https://github.com/jbcom/declarative-hex-worlds/commit/392697bb9ac2c763223a151aa2c8fb5b334f544a))
* E0 coverage batch-13 ([#23](https://github.com/jbcom/declarative-hex-worlds/issues/23)) ([64d27bc](https://github.com/jbcom/declarative-hex-worlds/commit/64d27bca903802e2204e325cd43c9e455ead371a))
* E0 coverage batch-14 ([#24](https://github.com/jbcom/declarative-hex-worlds/issues/24)) ([b99e951](https://github.com/jbcom/declarative-hex-worlds/commit/b99e9517649cd44f523f5d7bfa4c557beff42b66))
* E0 coverage batch-15 ([#25](https://github.com/jbcom/declarative-hex-worlds/issues/25)) ([3305ec5](https://github.com/jbcom/declarative-hex-worlds/commit/3305ec5c792ff062edc6371c64dbe297b9635b45))
* E0 coverage batch-16 ([#26](https://github.com/jbcom/declarative-hex-worlds/issues/26)) ([e5cd9d2](https://github.com/jbcom/declarative-hex-worlds/commit/e5cd9d29ed0727514a45d7e86c931eda830de052))
* E0 coverage batch-17 ([#27](https://github.com/jbcom/declarative-hex-worlds/issues/27)) ([72c1290](https://github.com/jbcom/declarative-hex-worlds/commit/72c129076c434690e83525459153426b3633f52d))
* E0 coverage batch-18 ([#28](https://github.com/jbcom/declarative-hex-worlds/issues/28)) ([722f3ef](https://github.com/jbcom/declarative-hex-worlds/commit/722f3ef6d8d6c65bc3dc1e325fe4cec1a6c776e8))
* E0 coverage batch-19a (layout excludeTerrain + excludeTileTags) ([#30](https://github.com/jbcom/declarative-hex-worlds/issues/30)) ([e0d65ea](https://github.com/jbcom/declarative-hex-worlds/commit/e0d65ea8e35468d4f2a16211b3c8a1dc3eca884e))
* E0 coverage batch-2 (movement profile + registry tile-geometry) ([#12](https://github.com/jbcom/declarative-hex-worlds/issues/12)) ([e6a4802](https://github.com/jbcom/declarative-hex-worlds/commit/e6a48027ecb981365fcb5bea6ac3086485669447))
* E0 coverage batch-20 (readGameboardQuests sort) ([#32](https://github.com/jbcom/declarative-hex-worlds/issues/32)) ([70a90f4](https://github.com/jbcom/declarative-hex-worlds/commit/70a90f491924d315b8831bbaa8ed71ff79956980))
* E0 coverage batch-21 (placement-id interaction target) ([#33](https://github.com/jbcom/declarative-hex-worlds/issues/33)) ([9e71fa2](https://github.com/jbcom/declarative-hex-worlds/commit/9e71fa2c9f74905ec7b8df4192127787d11b18a8))
* E0 coverage batch-22 (navigation.neighbors wrapper) ([#34](https://github.com/jbcom/declarative-hex-worlds/issues/34)) ([b3d19a4](https://github.com/jbcom/declarative-hex-worlds/commit/b3d19a429680b2a53fcc7b63e90ac7ba7ad0359c))
* E0 coverage batch-23 (patrol route validation) ([#35](https://github.com/jbcom/declarative-hex-worlds/issues/35)) ([2ed4d69](https://github.com/jbcom/declarative-hex-worlds/commit/2ed4d6913130ec714bec06071312711d303133fc))
* E0 coverage batch-24 (patrol route under-selected waypoints) ([#36](https://github.com/jbcom/declarative-hex-worlds/issues/36)) ([345ca3d](https://github.com/jbcom/declarative-hex-worlds/commit/345ca3dad20c74064fbf939aba50401f6894f11e))
* E0 coverage batch-25 (manifest header validation) ([#37](https://github.com/jbcom/declarative-hex-worlds/issues/37)) ([86d6eca](https://github.com/jbcom/declarative-hex-worlds/commit/86d6ecacaad080733259a94fe3ce1fa5906a7106))
* E0 coverage batch-26 (stack support mismatch) ([#38](https://github.com/jbcom/declarative-hex-worlds/issues/38)) ([522de83](https://github.com/jbcom/declarative-hex-worlds/commit/522de83a2e32f99a9055860a6c4875a28955b307))
* E0 coverage batch-27 (manifest unitStyle enum + ratchet) ([#39](https://github.com/jbcom/declarative-hex-worlds/issues/39)) ([715b9b7](https://github.com/jbcom/declarative-hex-worlds/commit/715b9b7e9f3681527b6132413efe52175d5a9e5b))
* E0 coverage batch-28 (resolveManifestAssetUrl URL+http) ([#40](https://github.com/jbcom/declarative-hex-worlds/issues/40)) ([b6cea08](https://github.com/jbcom/declarative-hex-worlds/commit/b6cea080526109c73fbf20afdbc1e9d5af3f86de))
* E0 coverage batch-29 (scenario spawn groups errors throw) ([#41](https://github.com/jbcom/declarative-hex-worlds/issues/41)) ([2897279](https://github.com/jbcom/declarative-hex-worlds/commit/2897279ed207dce0dd4e538900036d4449794906))
* E0 coverage batch-3 (actors + rules + fortification segments) ([#13](https://github.com/jbcom/declarative-hex-worlds/issues/13)) ([7db8197](https://github.com/jbcom/declarative-hex-worlds/commit/7db8197da4f517da0334343bd7f1c16460e91a1e))
* E0 coverage batch-30 (layout forbiddenAdjacentTerrain) ([#42](https://github.com/jbcom/declarative-hex-worlds/issues/42)) ([57223ae](https://github.com/jbcom/declarative-hex-worlds/commit/57223ae93bf969d09ae5c11237f0f15f25b088ee))
* E0 coverage batch-31 (layout missing-required-tags + missing-adjacent-placement-layer) ([#43](https://github.com/jbcom/declarative-hex-worlds/issues/43)) ([c114ece](https://github.com/jbcom/declarative-hex-worlds/commit/c114ece7c4dc5daa0a011396ac02a40f8b037910))
* E0 coverage batch-32 (layout distance + forbidden adjacency) ([#44](https://github.com/jbcom/declarative-hex-worlds/issues/44)) ([e9a01d7](https://github.com/jbcom/declarative-hex-worlds/commit/e9a01d76e491d98577ef03d41da6b21c85c8b01b))
* E0 coverage batch-33 (layout far-from-terrain preference) ([#45](https://github.com/jbcom/declarative-hex-worlds/issues/45)) ([b85156b](https://github.com/jbcom/declarative-hex-worlds/commit/b85156bc4ab71e246af81cfbadf61f63430eb790))
* E0 coverage batch-34 (layout footprint radius shorthand) ([#46](https://github.com/jbcom/declarative-hex-worlds/issues/46)) ([243cdbf](https://github.com/jbcom/declarative-hex-worlds/commit/243cdbfc3948df95dcb952b691103ff09d05e07e))
* E0 coverage batch-35 (scenario actor spawn + ratchet) ([#47](https://github.com/jbcom/declarative-hex-worlds/issues/47)) ([391f5bd](https://github.com/jbcom/declarative-hex-worlds/commit/391f5bd1ae90118d661fc63f33e89a5deadc230c))
* E0 coverage batch-36 (scenario actor_extra_flag_missing) ([#48](https://github.com/jbcom/declarative-hex-worlds/issues/48)) ([c0d3554](https://github.com/jbcom/declarative-hex-worlds/commit/c0d3554fb79999c4b5fbd6eb2ae2cc87cf057241))
* E0 coverage batch-37 (registry analyzeHexTileRegistry warnings) ([#49](https://github.com/jbcom/declarative-hex-worlds/issues/49)) ([9c68083](https://github.com/jbcom/declarative-hex-worlds/commit/9c68083693169d1c704734a11843196e4e859b06))
* E0 coverage batch-4 (scenario patrolAgent empty routeId) ([#14](https://github.com/jbcom/declarative-hex-worlds/issues/14)) ([548b547](https://github.com/jbcom/declarative-hex-worlds/commit/548b547f294e29276ae803c006b485218c71e275))
* E0 coverage batch-5 ([#15](https://github.com/jbcom/declarative-hex-worlds/issues/15)) ([4168bfc](https://github.com/jbcom/declarative-hex-worlds/commit/4168bfc21ba8afd6735e64e8d40546e38dacb809))
* E0 coverage batch-6 ([#16](https://github.com/jbcom/declarative-hex-worlds/issues/16)) ([9f5592b](https://github.com/jbcom/declarative-hex-worlds/commit/9f5592b2ecf83db8f694ae6b44c380d86cb890e3))
* E0 coverage batch-7 ([#17](https://github.com/jbcom/declarative-hex-worlds/issues/17)) ([2fb86dd](https://github.com/jbcom/declarative-hex-worlds/commit/2fb86dd6895952933b069e97256eff4e10b8db7c))
* E0 coverage batch-8 ([#18](https://github.com/jbcom/declarative-hex-worlds/issues/18)) ([b4412c4](https://github.com/jbcom/declarative-hex-worlds/commit/b4412c4e9c826582f43022a6daeced3a489fecb0))
* E0 coverage batch-9 ([#19](https://github.com/jbcom/declarative-hex-worlds/issues/19)) ([cc2d3ad](https://github.com/jbcom/declarative-hex-worlds/commit/cc2d3add128937e6df3b5c79427f03b4d2862d23))
* E0 coverage continuation (simulation/quests/rules) ([#10](https://github.com/jbcom/declarative-hex-worlds/issues/10)) ([e753cd4](https://github.com/jbcom/declarative-hex-worlds/commit/e753cd4277019b9f6237a5f0d93c500d1b67f378))


### Bug Fixes

* **audit:** mirror release-please manifest against package.json#version ([#54](https://github.com/jbcom/declarative-hex-worlds/issues/54)) ([04f45e6](https://github.com/jbcom/declarative-hex-worlds/commit/04f45e6cace8137074a91d19604ac426313bbd95))

## [1.0.0](https://github.com/jbcom/declarative-hex-worlds/compare/declarative-hex-worlds@0.1.0...declarative-hex-worlds@1.0.0) (2026-05-28)


### Features

* 1.0 stabilization phase 2 (PR [#4](https://github.com/jbcom/declarative-hex-worlds/issues/4)) ([14c5f77](https://github.com/jbcom/declarative-hex-worlds/commit/14c5f77b652f985582d8aad4167d5566b577952b))
* E0 coverage batch-10 ([#20](https://github.com/jbcom/declarative-hex-worlds/issues/20)) ([a4c2c83](https://github.com/jbcom/declarative-hex-worlds/commit/a4c2c8384667e926adef04970e26e61871f21234))
* E0 coverage batch-11 ([#21](https://github.com/jbcom/declarative-hex-worlds/issues/21)) ([4770638](https://github.com/jbcom/declarative-hex-worlds/commit/477063862b05333b8e7f8740fad21d0058bf3de2))
* E0 coverage batch-12 ([#22](https://github.com/jbcom/declarative-hex-worlds/issues/22)) ([392697b](https://github.com/jbcom/declarative-hex-worlds/commit/392697bb9ac2c763223a151aa2c8fb5b334f544a))
* E0 coverage batch-13 ([#23](https://github.com/jbcom/declarative-hex-worlds/issues/23)) ([64d27bc](https://github.com/jbcom/declarative-hex-worlds/commit/64d27bca903802e2204e325cd43c9e455ead371a))
* E0 coverage batch-14 ([#24](https://github.com/jbcom/declarative-hex-worlds/issues/24)) ([b99e951](https://github.com/jbcom/declarative-hex-worlds/commit/b99e9517649cd44f523f5d7bfa4c557beff42b66))
* E0 coverage batch-15 ([#25](https://github.com/jbcom/declarative-hex-worlds/issues/25)) ([3305ec5](https://github.com/jbcom/declarative-hex-worlds/commit/3305ec5c792ff062edc6371c64dbe297b9635b45))
* E0 coverage batch-16 ([#26](https://github.com/jbcom/declarative-hex-worlds/issues/26)) ([e5cd9d2](https://github.com/jbcom/declarative-hex-worlds/commit/e5cd9d29ed0727514a45d7e86c931eda830de052))
* E0 coverage batch-17 ([#27](https://github.com/jbcom/declarative-hex-worlds/issues/27)) ([72c1290](https://github.com/jbcom/declarative-hex-worlds/commit/72c129076c434690e83525459153426b3633f52d))
* E0 coverage batch-18 ([#28](https://github.com/jbcom/declarative-hex-worlds/issues/28)) ([722f3ef](https://github.com/jbcom/declarative-hex-worlds/commit/722f3ef6d8d6c65bc3dc1e325fe4cec1a6c776e8))
* E0 coverage batch-19a (layout excludeTerrain + excludeTileTags) ([#30](https://github.com/jbcom/declarative-hex-worlds/issues/30)) ([e0d65ea](https://github.com/jbcom/declarative-hex-worlds/commit/e0d65ea8e35468d4f2a16211b3c8a1dc3eca884e))
* E0 coverage batch-2 (movement profile + registry tile-geometry) ([#12](https://github.com/jbcom/declarative-hex-worlds/issues/12)) ([e6a4802](https://github.com/jbcom/declarative-hex-worlds/commit/e6a48027ecb981365fcb5bea6ac3086485669447))
* E0 coverage batch-20 (readGameboardQuests sort) ([#32](https://github.com/jbcom/declarative-hex-worlds/issues/32)) ([70a90f4](https://github.com/jbcom/declarative-hex-worlds/commit/70a90f491924d315b8831bbaa8ed71ff79956980))
* E0 coverage batch-21 (placement-id interaction target) ([#33](https://github.com/jbcom/declarative-hex-worlds/issues/33)) ([9e71fa2](https://github.com/jbcom/declarative-hex-worlds/commit/9e71fa2c9f74905ec7b8df4192127787d11b18a8))
* E0 coverage batch-22 (navigation.neighbors wrapper) ([#34](https://github.com/jbcom/declarative-hex-worlds/issues/34)) ([b3d19a4](https://github.com/jbcom/declarative-hex-worlds/commit/b3d19a429680b2a53fcc7b63e90ac7ba7ad0359c))
* E0 coverage batch-23 (patrol route validation) ([#35](https://github.com/jbcom/declarative-hex-worlds/issues/35)) ([2ed4d69](https://github.com/jbcom/declarative-hex-worlds/commit/2ed4d6913130ec714bec06071312711d303133fc))
* E0 coverage batch-24 (patrol route under-selected waypoints) ([#36](https://github.com/jbcom/declarative-hex-worlds/issues/36)) ([345ca3d](https://github.com/jbcom/declarative-hex-worlds/commit/345ca3dad20c74064fbf939aba50401f6894f11e))
* E0 coverage batch-25 (manifest header validation) ([#37](https://github.com/jbcom/declarative-hex-worlds/issues/37)) ([86d6eca](https://github.com/jbcom/declarative-hex-worlds/commit/86d6ecacaad080733259a94fe3ce1fa5906a7106))
* E0 coverage batch-26 (stack support mismatch) ([#38](https://github.com/jbcom/declarative-hex-worlds/issues/38)) ([522de83](https://github.com/jbcom/declarative-hex-worlds/commit/522de83a2e32f99a9055860a6c4875a28955b307))
* E0 coverage batch-27 (manifest unitStyle enum + ratchet) ([#39](https://github.com/jbcom/declarative-hex-worlds/issues/39)) ([715b9b7](https://github.com/jbcom/declarative-hex-worlds/commit/715b9b7e9f3681527b6132413efe52175d5a9e5b))
* E0 coverage batch-28 (resolveManifestAssetUrl URL+http) ([#40](https://github.com/jbcom/declarative-hex-worlds/issues/40)) ([b6cea08](https://github.com/jbcom/declarative-hex-worlds/commit/b6cea080526109c73fbf20afdbc1e9d5af3f86de))
* E0 coverage batch-29 (scenario spawn groups errors throw) ([#41](https://github.com/jbcom/declarative-hex-worlds/issues/41)) ([2897279](https://github.com/jbcom/declarative-hex-worlds/commit/2897279ed207dce0dd4e538900036d4449794906))
* E0 coverage batch-3 (actors + rules + fortification segments) ([#13](https://github.com/jbcom/declarative-hex-worlds/issues/13)) ([7db8197](https://github.com/jbcom/declarative-hex-worlds/commit/7db8197da4f517da0334343bd7f1c16460e91a1e))
* E0 coverage batch-30 (layout forbiddenAdjacentTerrain) ([#42](https://github.com/jbcom/declarative-hex-worlds/issues/42)) ([57223ae](https://github.com/jbcom/declarative-hex-worlds/commit/57223ae93bf969d09ae5c11237f0f15f25b088ee))
* E0 coverage batch-31 (layout missing-required-tags + missing-adjacent-placement-layer) ([#43](https://github.com/jbcom/declarative-hex-worlds/issues/43)) ([c114ece](https://github.com/jbcom/declarative-hex-worlds/commit/c114ece7c4dc5daa0a011396ac02a40f8b037910))
* E0 coverage batch-32 (layout distance + forbidden adjacency) ([#44](https://github.com/jbcom/declarative-hex-worlds/issues/44)) ([e9a01d7](https://github.com/jbcom/declarative-hex-worlds/commit/e9a01d76e491d98577ef03d41da6b21c85c8b01b))
* E0 coverage batch-33 (layout far-from-terrain preference) ([#45](https://github.com/jbcom/declarative-hex-worlds/issues/45)) ([b85156b](https://github.com/jbcom/declarative-hex-worlds/commit/b85156bc4ab71e246af81cfbadf61f63430eb790))
* E0 coverage batch-34 (layout footprint radius shorthand) ([#46](https://github.com/jbcom/declarative-hex-worlds/issues/46)) ([243cdbf](https://github.com/jbcom/declarative-hex-worlds/commit/243cdbfc3948df95dcb952b691103ff09d05e07e))
* E0 coverage batch-35 (scenario actor spawn + ratchet) ([#47](https://github.com/jbcom/declarative-hex-worlds/issues/47)) ([391f5bd](https://github.com/jbcom/declarative-hex-worlds/commit/391f5bd1ae90118d661fc63f33e89a5deadc230c))
* E0 coverage batch-36 (scenario actor_extra_flag_missing) ([#48](https://github.com/jbcom/declarative-hex-worlds/issues/48)) ([c0d3554](https://github.com/jbcom/declarative-hex-worlds/commit/c0d3554fb79999c4b5fbd6eb2ae2cc87cf057241))
* E0 coverage batch-37 (registry analyzeHexTileRegistry warnings) ([#49](https://github.com/jbcom/declarative-hex-worlds/issues/49)) ([9c68083](https://github.com/jbcom/declarative-hex-worlds/commit/9c68083693169d1c704734a11843196e4e859b06))
* E0 coverage batch-4 (scenario patrolAgent empty routeId) ([#14](https://github.com/jbcom/declarative-hex-worlds/issues/14)) ([548b547](https://github.com/jbcom/declarative-hex-worlds/commit/548b547f294e29276ae803c006b485218c71e275))
* E0 coverage batch-5 ([#15](https://github.com/jbcom/declarative-hex-worlds/issues/15)) ([4168bfc](https://github.com/jbcom/declarative-hex-worlds/commit/4168bfc21ba8afd6735e64e8d40546e38dacb809))
* E0 coverage batch-6 ([#16](https://github.com/jbcom/declarative-hex-worlds/issues/16)) ([9f5592b](https://github.com/jbcom/declarative-hex-worlds/commit/9f5592b2ecf83db8f694ae6b44c380d86cb890e3))
* E0 coverage batch-7 ([#17](https://github.com/jbcom/declarative-hex-worlds/issues/17)) ([2fb86dd](https://github.com/jbcom/declarative-hex-worlds/commit/2fb86dd6895952933b069e97256eff4e10b8db7c))
* E0 coverage batch-8 ([#18](https://github.com/jbcom/declarative-hex-worlds/issues/18)) ([b4412c4](https://github.com/jbcom/declarative-hex-worlds/commit/b4412c4e9c826582f43022a6daeced3a489fecb0))
* E0 coverage batch-9 ([#19](https://github.com/jbcom/declarative-hex-worlds/issues/19)) ([cc2d3ad](https://github.com/jbcom/declarative-hex-worlds/commit/cc2d3add128937e6df3b5c79427f03b4d2862d23))
* E0 coverage continuation (simulation/quests/rules) ([#10](https://github.com/jbcom/declarative-hex-worlds/issues/10)) ([e753cd4](https://github.com/jbcom/declarative-hex-worlds/commit/e753cd4277019b9f6237a5f0d93c500d1b67f378))


### Bug Fixes

* **audit:** mirror release-please manifest against package.json#version ([#54](https://github.com/jbcom/declarative-hex-worlds/issues/54)) ([04f45e6](https://github.com/jbcom/declarative-hex-worlds/commit/04f45e6cace8137074a91d19604ac426313bbd95))

## [Unreleased]

### Removed

- **BREAKING:** Dropped the `declarative-hex-worlds/examples/simple-rpg-usage` package subpath. SimpleRPG is a test driver, not a published example; its TypeScript source, JSON fixtures, and compiled module no longer ship in the npm tarball. SimpleRPG evidence stays reachable through the bundled CLI (`declarative-hex-worlds coverage --json` / `doctor --coverage`). The in-repo driver moved to `tests/integration/simple-rpg/simple-rpg.ts` with fixtures under `tests/integration/simple-rpg/fixtures/`; e2e harness skeleton at `tests/e2e/simple-rpg/` will be fleshed out by PRD `RS1`-`RS3` (PRD R4).

### Added

- Astro Starlight docs site at `docs-site/` with 1,107 reference pages generated from JSDoc via `starlight-typedoc` (PRD F-Site-1 through F-Site-6).
- `safeResolveOutput()` jails every CLI `--out*` flag's resolved path inside `cwd`; `extract` requires `--force` to wipe a non-empty destination (PRD C1).
- `useStableOptions()` hook in `src/react/react.ts` hash-stabilizes the 8 selector hooks' option objects so caller-supplied fresh literals stop busting `useMemo` (PRD B7).
- `gameboardPlanIndex(plan)` helper memoizes `tilesByKey` + `placementsByTile` per plan via a module-local WeakMap; 6 in-call rebuilds in `coordinates/layout.ts` + `interop/interop.ts` now hit O(1) lookups (PRD B4).
- `loadFreeManifest()` async accessor ships alongside the eager `freeManifest` export (PRD B2b).
- Structured error taxonomy: `GameboardError` base + 6 subclasses (`GameboardValidationError`, `GameboardManifestError`, `GameboardScenarioError`, `GameboardRuntimeError`, `GameboardCliError`, `GameboardIoError`). 152 throw sites migrated (PRD D2).
- Coverage instrumentation across unit + browser + e2e harnesses with merged report (PRD R6).
- Coverage ratchet threshold at current baseline; CI fails on regressions (PRD A8).
- Manifest drift gate (`pnpm test:manifest-drift`) + warm-start bench (`pnpm bench:warm-start`) (PRD A3b).
- CI install-once + node_modules artifact pattern shared across jobs (PRD A9).
- `noUncheckedIndexedAccess: true` in tsconfig.base.json; 125 type errors closed (PRD A2a).
- pnpm audit `--prod --audit-level=high` gate; dependency-review-action; semgrep p/owasp-top-ten + p/nodejs SAST (PRD A4 / A7).
- Co-located unit tests under `src/<domain>/__tests__/` matching the R2 decomposition (PRD R3b).

### Changed

- Single-package layout: monorepo dropped in favor of root-level package (PRD R1). 587 files moved out of `packages/declarative-hex-worlds/`.
- `src/` decomposed into 20 domain sub-packages with barrel-only cross-domain imports enforced by Biome `noRestrictedImports` (PRD R2 + R3).
- React, Three, react-dom, koota, honeycomb-grid, seedrandom moved from `peerDependencies` to `dependencies` — the library is unusable without them (PRD D6b).
- Asset model: tarball ships only `assets/free/manifest.json`; the GLTF tree is bootstrapped at install time by the CLI `bootstrap` subcommand (PRD §Phase RB).
- `createKayKitGuideScenarios` in `src/scenario/catalog.ts` inverted from 377-line imperative builder to a top-level data table + 5-line map (PRD D4).
- `scripts/smoke-packed-consumer.ts` split into `scripts/smoke/pack-install.ts` + `scripts/smoke/types.ts` + a thin orchestrator with labelled-phase output (PRD D10).
- CLI error messages relativize absolute paths against `cwd` so CI/CD logs don't leak developer directory layouts (PRD C5).
- release-please now prefers a GitHub App token over the legacy `CI_GITHUB_TOKEN` PAT, falling back when the App isn't yet provisioned (PRD A5).

### Removed

- `peerDependencies` block from `package.json`. React/Three/react-dom etc. are direct dependencies now.
- Legacy vitepress docs site under `apps/docs` (R1 deleted the directory; F-Site-12 will remove the remaining `docs/` content once the Astro migration completes).
- Bundled `assets/free/` GLTF tree from the published tarball.

## [0.1.0] - 2026-05-22

Initial pre-release. Library scaffold + first KayKit FREE pack manifest + react/three bindings.
