# MST Visualizer

A dark, interactive minimum-spanning-tree lab for infrastructure network design. Edit weighted graphs, step through Kruskal's and Prim's algorithms, inspect four Union-Find variants, and compare measured browser-local execution times.

## Requirements

- Python 3 (for the local static web server)
- The [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html), including `emcc`, to compile the C algorithms
- A modern browser with WebAssembly support

The project has no npm runtime dependencies. `npm run build:wasm` generates `wasm/mst.js` and `wasm/mst.wasm` from the C sources.

## Build and run

1. Install and activate Emscripten (Windows PowerShell example; adjust the path to your SDK):

   ```powershell
   & "C:\emsdk\emsdk.bat" install latest
   & "C:\emsdk\emsdk.bat" activate latest
   & "C:\emsdk\emsdk_env.ps1"
   ```

2. From the project root, compile the algorithms:

   ```powershell
   npm run build:wasm
   ```

   This compiles `c/main.c`, `c/kruskal.c`, `c/prim.c`, and `c/union_find.c` into the browser loader and WebAssembly module under `wasm/`.

3. Serve the project over HTTP (do not open `index.html` directly, since browsers restrict WebAssembly loading from `file://`):

   ```powershell
   npm run serve
   ```

4. Open [http://localhost:8000](http://localhost:8000).

If the WASM build has not been generated, the interface reports that the C engine is unavailable. It never substitutes JavaScript algorithm results or invented timings.

## Using the application

- **Simulator:** load the four-vertex sample, add/delete vertices and edges, edit selected edge weights, drag nodes, or generate a connected random graph. Select an algorithm, then play, pause, step, or reset. Prim's start vertex can be changed before running. Disconnected inputs are reported as minimum spanning forests.
- **Analysis:** run the benchmarks to time repeated executions of each C algorithm on deterministic sparse, medium, and dense connected networks. The chart, result table, and MST weights are populated from those executions. Union-Find timings and operation counts come from four C variants.
- **Theory / About:** browse the algorithm explanations and project/contributor details.

Timings use `performance.now()` around repeated WebAssembly calls, normalized per execution, and depend on the local device and browser. They are empirical measurements, not theoretical complexity estimates.

## Run the C algorithm tests

Install a native C compiler (`gcc`, `clang`, or `cc`), or activate Emscripten and install Node.js, then run:

```powershell
npm run test:c
```

The test harness checks the specified sample MST in both algorithms, disconnected graphs with negative weights, and Union-Find operation counters. It builds into a temporary directory and removes its outputs when finished.

## Implementation notes

- Kruskal sorts weighted edges in C and calls the selected C Union-Find variant.
- Prim uses C adjacency lists and a binary min-heap.
- Naive, union-by-rank, path-compression, and combined Union-Find implementations are in C.
- JavaScript is limited to graph editing, SVG rendering, step playback, WebAssembly memory marshaling, and timing/reporting of actual C calls.
- The predefined A-B=1, B-C=2, A-C=3, C-D=4, B-D=5 graph has MST A-B, B-C, C-D and total weight 7.
