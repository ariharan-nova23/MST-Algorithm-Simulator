const EVENT_NAMES = {
  1: "sort",
  2: "initialize",
  3: "kruskal-examine",
  4: "kruskal-find",
  5: "kruskal-accept",
  6: "kruskal-reject",
  7: "complete",
  8: "disconnected",
  9: "prim-start",
  10: "prim-extract",
  11: "prim-examine",
  12: "prim-update",
  13: "prim-accept",
  14: "prim-skip"
};

const EVENT_BYTES = 8 * Int32Array.BYTES_PER_ELEMENT;

export class WasmBridge {
  constructor() {
    this.module = null;
  }

  async initialize() {
    if (typeof globalThis.createMstModule !== "function") {
      throw new Error("The generated C/WebAssembly engine was not found. Run `npm run build:wasm` after installing Emscripten.");
    }
    this.module = await globalThis.createMstModule();
    if (!(this.module.HEAP32 instanceof Int32Array) || typeof this.module._malloc !== "function") {
      throw new Error("The generated WebAssembly module is missing its exported memory view. Rebuild it with `npm run build:wasm`.");
    }
    return true;
  }

  requireModule() {
    if (!this.module) throw new Error("The C/WebAssembly engine is not ready.");
    return this.module;
  }

  withEdges(edges, callback) {
    const module = this.requireModule();
    const values = new Int32Array(Math.max(1, edges.length * 3));
    edges.forEach((edge, index) => {
      values[index * 3] = edge.u;
      values[index * 3 + 1] = edge.v;
      values[index * 3 + 2] = edge.weight;
    });
    const pointer = module._malloc(values.byteLength);
    if (!pointer) throw new Error("WebAssembly could not allocate memory for this graph.");
    try {
      module.HEAP32.set(values, pointer >>> 2);
      return callback(module, pointer);
    } finally {
      module._free(pointer);
    }
  }

  run(algorithm, vertices, edges, startVertex) {
    const module = this.requireModule();
    if (vertices.length === 0) throw new Error("Add at least one vertex before running an algorithm.");
    const eventCapacity = algorithm === "prim"
      ? edges.length * 8 + vertices.length * 5 + 32
      : edges.length * 4 + 8;
    return this.withEdges(edges, (wasm, edgePointer) => {
      const eventPointer = wasm._malloc(Math.max(1, eventCapacity) * EVENT_BYTES);
      if (!eventPointer) throw new Error("WebAssembly could not allocate memory for the algorithm trace.");
      try {
        const count = algorithm === "prim"
          ? wasm._run_prim(edgePointer, vertices.length, edges.length, startVertex, eventPointer, eventCapacity)
          : wasm._run_kruskal(edgePointer, vertices.length, edges.length, eventPointer, eventCapacity);
        if (count < 0) throw new Error(this.errorMessage(count));
        const base = eventPointer >>> 2;
        const events = [];
        for (let index = 0; index < count; index++) {
          const offset = base + index * 8;
          events.push({
            type: EVENT_NAMES[wasm.HEAP32[offset]],
            a: wasm.HEAP32[offset + 1],
            b: wasm.HEAP32[offset + 2],
            weight: wasm.HEAP32[offset + 3],
            total: wasm.HEAP32[offset + 4],
            selected: wasm.HEAP32[offset + 5],
            x: wasm.HEAP32[offset + 6],
            y: wasm.HEAP32[offset + 7]
          });
        }
        return {
          events,
          total: wasm._get_result_total(),
          count: wasm._get_result_count(),
          components: wasm._get_result_components()
        };
      } finally {
        wasm._free(eventPointer);
      }
    });
  }

  benchmark(algorithm, vertices, edges, startVertex, repeats) {
    return this.withEdges(edges, (module, edgePointer) => {
      const started = performance.now();
      const result = algorithm === "prim"
        ? module._benchmark_prim(edgePointer, vertices, edges.length, startVertex, repeats)
        : module._benchmark_kruskal(edgePointer, vertices, edges.length, repeats);
      const elapsed = performance.now() - started;
      if (result < 0) throw new Error(this.errorMessage(result));
      return {
        milliseconds: elapsed / repeats,
        total: module._get_result_total(),
        count: module._get_result_count(),
        components: module._get_result_components()
      };
    });
  }

  benchmarkUnionFind(vertices, edges, variant, repeats) {
    return this.withEdges(edges, (module, edgePointer) => {
      const started = performance.now();
      const result = module._benchmark_uf(edgePointer, vertices, edges.length, variant, repeats);
      const elapsed = performance.now() - started;
      if (result < 0) throw new Error(this.errorMessage(result));
      return {
        milliseconds: elapsed / repeats,
        findCalls: module._get_uf_find_calls(),
        unionCalls: module._get_uf_union_calls(),
        parentHops: module._get_uf_hops(),
        maxDepth: module._get_uf_max_depth()
      };
    });
  }

  errorMessage(code) {
    if (code === -1) return "The C algorithm rejected invalid graph data.";
    if (code === -2) return "The C algorithm trace exceeded its allocated capacity.";
    if (code === -3) return "The C algorithm could not allocate enough memory.";
    return `The C algorithm returned an unexpected error (${code}).`;
  }
}
