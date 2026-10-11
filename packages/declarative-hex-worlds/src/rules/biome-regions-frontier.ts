/** Priority frontier for tile biome growth; newest scores supersede stale entries. @module */
export interface BiomeCandidate {
  key: string;
  score: number;
}

function before(a: BiomeCandidate, b: BiomeCandidate): boolean {
  return a.score > b.score || (a.score === b.score && a.key < b.key);
}

/** Binary max heap with lazy invalidation when neighbouring affinities change. */
export class BiomeFrontier {
  private heap: BiomeCandidate[] = [];
  private current = new Map<string, BiomeCandidate>();

  has(key: string): boolean {
    return this.current.has(key);
  }

  offer(candidate: BiomeCandidate): void {
    this.current.set(candidate.key, candidate);
    this.heap.push(candidate);
    let i = this.heap.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      const old = this.heap[parent] as BiomeCandidate;
      if (!before(candidate, old)) break;
      this.heap[i] = old;
      i = parent;
    }
    this.heap[i] = candidate;
  }

  take(): BiomeCandidate | undefined {
    while (this.heap.length > 0) {
      const candidate = this.heap[0] as BiomeCandidate;
      const last = this.heap.pop() as BiomeCandidate;
      if (this.heap.length > 0) this.sink(last);
      if (this.current.get(candidate.key) !== candidate) continue;
      this.current.delete(candidate.key);
      return candidate;
    }
    return undefined;
  }

  private sink(candidate: BiomeCandidate): void {
    let i = 0;
    while (i * 2 + 1 < this.heap.length) {
      let child = i * 2 + 1;
      if (
        child + 1 < this.heap.length &&
        before(this.heap[child + 1] as BiomeCandidate, this.heap[child] as BiomeCandidate)
      )
        child += 1;
      const next = this.heap[child] as BiomeCandidate;
      if (!before(next, candidate)) break;
      this.heap[i] = next;
      i = child;
    }
    this.heap[i] = candidate;
  }
}
