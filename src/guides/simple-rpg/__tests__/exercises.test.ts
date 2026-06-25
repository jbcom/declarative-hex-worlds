import { afterEach, describe, expect, it, vi } from 'vitest';

describe('SimpleRPG guide exercise fallback coverage', () => {
  afterEach(() => {
    vi.doUnmock('declarative-hex-worlds/catalog');
    vi.resetModules();
  });

  it('keeps exercise evidence when guide coverage metadata is absent', async () => {
    vi.resetModules();
    vi.doMock('declarative-hex-worlds/catalog', () => ({
      listKayKitGuidePublicApiCoverages: () => [],
    }));

    const { listSimpleRpgGuidePublicApiExercises } = await import('../exercises');
    const bridge = listSimpleRpgGuidePublicApiExercises().find(
      (exercise) => exercise.publicApi === 'GameboardBuilder.addBridge'
    );

    expect(bridge).toMatchObject({
      publicApi: 'GameboardBuilder.addBridge',
      pages: [],
      scenarioIds: [],
      assetCount: 0,
      visualArtifacts: [],
    });
  });
});
