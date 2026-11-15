import { GraphEditor, createRandomGraph, edgeKey, sampleGraph } from "./graph.js";
import { WasmBridge } from "./wasm-bridge.js";
import { TracePlayer } from "./visualization.js";
import { drawAlgorithmChart, drawUnionChart } from "./charts.js";

const byId = (id) => document.getElementById(id);
const bridge = new WasmBridge();
let bridgeReady = false;
let currentAlgorithm = "kruskal";
let isPlaying = false;
let playbackTimer = null;
let lastBenchmarks = null;
let graph;
let player;

const elements = {
  vertexCount: byId("vertex-count"),
  edgeCount: byId("edge-count"),
  deleteVertex: byId("delete-vertex-select"),
  edgeFrom: byId("edge-from"),
  edgeTo: byId("edge-to"),
  primStart: byId("prim-start"),
  selectedEdgeLabel: byId("selected-edge-label"),
  editEdgeWeight: byId("edit-edge-weight"),
  play: byId("play-button"),
  next: byId("next-step"),
  reset: byId("reset-algorithm"),
  trace: byId("trace-list"),
  engineStatus: byId("engine-status"),
  engineDot: byId("engine-dot"),
  toastRegion: byId("toast-region")
};

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  elements.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function labelsForSelect(select, vertices, preferredValue = null) {
  const previous = preferredValue ?? select.value;
  select.replaceChildren();
  for (const vertex of vertices) {
    const option = document.createElement("option");
    option.value = String(vertex.id);
    option.textContent = vertex.label;
    select.append(option);
  }
  if (vertices.some((vertex) => String(vertex.id) === previous)) {
    select.value = previous;
  } else if (vertices.length) {
    select.value = String(vertices[0].id);
  }
  select.disabled = vertices.length === 0;
}

function refreshGraphControls() {
  const vertices = graph.vertices;
  elements.vertexCount.textContent = String(vertices.length);
  elements.edgeCount.textContent = String(graph.edges.length);
  labelsForSelect(elements.deleteVertex, vertices);
  labelsForSelect(elements.edgeFrom, vertices);
  labelsForSelect(elements.edgeTo, vertices, vertices.length > 1 ? String(vertices[1].id) : null);
  labelsForSelect(elements.primStart, vertices);
  byId("delete-vertex").disabled = vertices.length === 0;
  byId("add-edge").disabled = vertices.length < 2;
  byId("random-graph").disabled = false;
  byId("clear-graph").disabled = vertices.length === 0 && graph.edges.length === 0;
  byId("update-edge").disabled = graph.selectedEdge === null;
  byId("delete-edge").disabled = graph.selectedEdge === null;
  byId("edge-from").disabled = vertices.length < 2;
  byId("edge-to").disabled = vertices.length < 2;
  byId("prim-start").disabled = vertices.length === 0;
  updateRunControls();
}

function updateRunControls(traceAvailable = Boolean(player?.events.length), canStep = traceAvailable) {
  const graphCanRun = graph?.vertices.length > 0;
  elements.play.disabled = !bridgeReady || !graphCanRun;
  elements.next.disabled = !bridgeReady || !graphCanRun || (traceAvailable && !canStep);
  elements.reset.disabled = !player || player.events.length === 0;
  if (!isPlaying && !player?.events.length) {
    elements.play.innerHTML = "▶ <span>Run algorithm</span>";
  }
}

function onGraphChange() {
  if (!graph) return;
  refreshGraphControls();
  if (player) {
    stopPlayback();
    player.reset();
    updateRunControls(false, false);
  }
}

function onGraphSelection(selection) {
  if (!graph) return;
  const edge = selection.edge;
  elements.selectedEdgeLabel.textContent = edge
    ? `${graph.vertices.find((vertex) => vertex.id === edge.u)?.label ?? "?"} — ${graph.vertices.find((vertex) => vertex.id === edge.v)?.label ?? "?"}`
    : "NONE";
  elements.editEdgeWeight.value = edge ? String(edge.weight) : "";
  refreshGraphControls();
}

graph = new GraphEditor(
  byId("graph-canvas"),
  onGraphChange,
  onGraphSelection,
  (u, v) => {
    const error = graph.addEdge(u, v, Number(byId("edge-weight").value));
    if (error) showToast(error, "error");
  }
);

player = new TracePlayer({
  svgGraph: graph,
  traceList: elements.trace,
  stepCounter: byId("step-counter"),
  totalWeight: byId("mst-weight"),
  edgeCount: byId("mst-edge-count"),
  componentCount: byId("component-count"),
  resultMessage: byId("result-message"),
  algorithmState: byId("algorithm-state"),
  insight: byId("edge-insight"),
  onStep: (hasMore, traceAvailable) => updateRunControls(traceAvailable, hasMore)
});

function stopPlayback() {
  if (playbackTimer !== null) {
    window.clearInterval(playbackTimer);
    playbackTimer = null;
  }
  isPlaying = false;
  if (elements.play && player?.events.length) {
    elements.play.innerHTML = "▶ <span>Play</span>";
  }
}

function pauseOrResume() {
  if (isPlaying) {
    stopPlayback();
    return;
  }
  if (!player.events.length) return;
  const interval = Number(byId("speed-range").value);
  isPlaying = true;
  elements.play.innerHTML = "Ⅱ <span>Pause</span>";
  playbackTimer = window.setInterval(() => {
    if (!player.step()) stopPlayback();
  }, interval);
}

function startTrace() {
  if (!bridgeReady) {
    showToast("Build the C/WebAssembly engine first. Setup instructions are in README.md.", "error");
    return false;
  }
  try {
    const startVertex = Number(byId("prim-start").value || graph.vertices[0]?.id || 0);
    const result = bridge.run(currentAlgorithm, graph.vertices, graph.edges, startVertex);
    player.load(result, currentAlgorithm, graph.vertices);
    if (result.events.length === 0) throw new Error("The C algorithm returned an empty execution trace.");
    return true;
  } catch (error) {
    showToast(error.message, "error");
    return false;
  }
}

function handleRun() {
  if (player.events.length && player.index >= player.events.length) {
    stopPlayback();
    if (!startTrace()) return;
  }
  if (!player.events.length && !startTrace()) return;
  pauseOrResume();
}

elements.play.addEventListener("click", handleRun);
elements.next.addEventListener("click", () => {
  if (!player.events.length && !startTrace()) return;
  stopPlayback();
  player.step();
});
elements.reset.addEventListener("click", () => {
  stopPlayback();
  player.reset();
  updateRunControls(false, false);
});

byId("add-vertex").addEventListener("click", () => {
  if (!graph.addVertex()) showToast("The graph limit is 64 vertices.", "error");
});
byId("delete-vertex").addEventListener("click", () => {
  const id = Number(elements.deleteVertex.value);
  if (Number.isInteger(id)) graph.deleteVertex(id);
});
byId("add-edge").addEventListener("click", () => {
  const error = graph.addEdge(Number(elements.edgeFrom.value), Number(elements.edgeTo.value), byId("edge-weight").valueAsNumber);
  if (error) showToast(error, "error");
});
byId("update-edge").addEventListener("click", () => {
  const error = graph.updateSelectedEdgeWeight(elements.editEdgeWeight.valueAsNumber);
  if (error) showToast(error, "error");
});
byId("delete-edge").addEventListener("click", () => {
  const error = graph.deleteSelectedEdge();
  if (error) showToast(error, "error");
});
byId("clear-graph").addEventListener("click", () => {
  graph.clear();
  showToast("Graph cleared. Add vertices to build a new network.");
});
byId("load-sample").addEventListener("click", () => {
  graph.setGraph(sampleGraph(byId("sample-select").value));
});
byId("random-graph").addEventListener("click", () => {
  graph.setGraph(createRandomGraph());
});
byId("select-tool").addEventListener("click", () => {
  graph.setTool("select");
  byId("select-tool").classList.add("active");
  byId("connect-tool").classList.remove("active");
  byId("canvas-hint").textContent = "Drag vertices to arrange · Select an edge to edit it";
});
byId("connect-tool").addEventListener("click", () => {
  graph.setTool("connect");
  byId("connect-tool").classList.add("active");
  byId("select-tool").classList.remove("active");
  byId("canvas-hint").textContent = "Select two vertices to create an edge · Esc to cancel";
});
document.querySelectorAll(".algorithm-option").forEach((button) => {
  button.addEventListener("click", () => {
    if (currentAlgorithm === button.dataset.algorithm) return;
    currentAlgorithm = button.dataset.algorithm;
    stopPlayback();
    document.querySelectorAll(".algorithm-option").forEach((option) => option.classList.toggle("active", option === button));
    byId("start-selector").classList.toggle("visible", currentAlgorithm === "prim");
    player.reset();
    updateRunControls(false, false);
  });
});
byId("speed-range").addEventListener("input", (event) => {
  const ratio = 750 / Number(event.target.value);
  byId("speed-label").textContent = `${ratio.toFixed(ratio === 1 ? 0 : 1)}×`;
  if (isPlaying) {
    stopPlayback();
    pauseOrResume();
  }
});

function navigateTo(page) {
  const target = document.getElementById(`page-${page}`);
  if (!target) return;
  document.querySelectorAll(".page-section").forEach((section) => section.classList.toggle("active", section === target));
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.page === page));
  byId("page-title").textContent = target.dataset.title;
  byId("sidebar").classList.remove("sidebar-open");
  if (page === "analysis" && lastBenchmarks) drawSavedBenchmarks();
}

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const page = link.dataset.page;
    history.replaceState(null, "", `#${page}`);
    navigateTo(page);
  });
});
document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => {
    const page = button.dataset.go;
    history.replaceState(null, "", `#${page}`);
    navigateTo(page);
  });
});
window.addEventListener("hashchange", () => navigateTo(location.hash.slice(1) || "home"));
byId("menu-toggle").addEventListener("click", () => byId("sidebar").classList.toggle("sidebar-open"));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && graph.tool === "connect") {
    graph.setTool("select");
    byId("select-tool").click();
  }
});

function generateBenchmarkGraph(size, density, seed) {
  let state = seed >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const edges = [];
  const seen = new Set();
  const add = (u, v) => {
    const key = edgeKey(u, v);
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ u, v, weight: 1 + Math.floor(random() * 100) });
  };
  for (let vertex = 1; vertex < size; vertex++) add(vertex, vertex - 1);
  const possible = (size * (size - 1)) / 2;
  const target = Math.max(size - 1, Math.floor(possible * density));
  for (let attempt = 0; edges.length < target && attempt < possible * 3; attempt++) {
    const u = Math.floor(random() * size);
    const v = Math.floor(random() * size);
    if (u !== v) add(u, v);
  }
  return edges;
}

function makeUnionWorkload(size) {
  const edges = [];
  for (let vertex = 0; vertex < size - 1; vertex++) {
    edges.push({ u: vertex + 1, v: vertex, weight: 1 });
  }
  for (let index = 0; index < Math.floor(size / 2); index++) {
    edges.push({ u: 0, v: size - 1, weight: 1 });
  }
  return edges;
}

function drawSavedBenchmarks() {
  if (!lastBenchmarks) return;
  drawAlgorithmChart(byId("algorithm-chart"), lastBenchmarks.samples);
  drawUnionChart(byId("union-chart"), lastBenchmarks.variants);
}

function setBenchmarkStatus(label, isError = false) {
  const status = byId("benchmark-status");
  status.textContent = label;
  status.classList.toggle("status-error", isError);
  status.classList.toggle("status-ready", !isError && label === "MEASURED");
}

async function runBenchmarks() {
  if (!bridgeReady) {
    showToast("Build the C/WebAssembly engine before measuring algorithms.", "error");
    return;
  }
  const button = byId("run-benchmarks");
  button.disabled = true;
  button.textContent = "◷ Measuring…";
  setBenchmarkStatus("MEASURING");
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const configurations = [
      { label: "Sparse", density: 0.14, seed: 241 },
      { label: "Medium", density: 0.43, seed: 913 },
      { label: "Dense", density: 0.82, seed: 1729 }
    ];
    const samples = [];
    for (const configuration of configurations) {
      const vertices = 28;
      const edges = generateBenchmarkGraph(vertices, configuration.density, configuration.seed);
      const kruskal = calibratedBenchmark((repeats) =>
        bridge.benchmark("kruskal", vertices, edges, 0, repeats));
      const prim = calibratedBenchmark((repeats) =>
        bridge.benchmark("prim", vertices, edges, 0, repeats));
      if (kruskal.total !== prim.total || kruskal.count !== prim.count ||
          kruskal.count !== vertices - 1 || kruskal.components !== 1 || prim.components !== 1) {
        throw new Error(`The C algorithms disagreed on the ${configuration.label.toLowerCase()} benchmark graph.`);
      }
      samples.push({
        ...configuration,
        vertices,
        edgeCount: edges.length,
        kruskalMs: kruskal.milliseconds,
        primMs: prim.milliseconds,
        kruskalTotal: kruskal.total,
        primTotal: prim.total
      });
    }

    const ufWorkload = makeUnionWorkload(96);
    const variants = [
      { name: "Naive", shortName: "Naive", id: 0 },
      { name: "Union by rank", shortName: "By rank", id: 1 },
      { name: "Path compression", shortName: "Compression", id: 2 },
      { name: "Rank + compression", shortName: "Rank + compress", id: 3 }
    ].map((variant) => ({
      ...variant,
      ...calibratedBenchmark((repeats) =>
        bridge.benchmarkUnionFind(96, ufWorkload, variant.id, repeats))
    }));

    lastBenchmarks = { samples, variants };
    byId("bench-graphs").textContent = String(samples.length);
    byId("bench-timestamp").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    byId("benchmark-rows").innerHTML = samples.map((sample) =>
      `<tr><td><span class="density-pill ${sample.label.toLowerCase()}">${sample.label}</span></td><td>${sample.vertices}</td><td>${sample.edgeCount}</td><td>${sample.kruskalMs.toFixed(4)} ms</td><td>${sample.primMs.toFixed(4)} ms</td><td>${sample.kruskalTotal} / ${sample.primTotal}</td></tr>`
    ).join("");
    byId("uf-details").innerHTML = variants.map((variant) =>
      `<div class="uf-detail"><b>${variant.name}</b><span>${variant.findCalls.toLocaleString()} Find calls · ${variant.parentHops.toLocaleString()} parent hops</span><small>${variant.unionCalls.toLocaleString()} Union calls · max depth ${variant.maxDepth}</small></div>`
    ).join("");
    drawSavedBenchmarks();
    setBenchmarkStatus("MEASURED");
  } catch (error) {
    setBenchmarkStatus("FAILED", true);
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = "▶ Run benchmarks";
  }
}

function calibratedBenchmark(run) {
  let result = run(160);
  const elapsed = result.milliseconds * 160;
  if (elapsed < 20) {
    const repeats = Math.max(160, Math.min(10000, Math.ceil(20 * 160 / Math.max(elapsed, 0.01))));
    result = run(repeats);
  }
  return result;
}

byId("run-benchmarks").addEventListener("click", runBenchmarks);
window.addEventListener("resize", () => {
  if (lastBenchmarks && document.getElementById("page-analysis").classList.contains("active")) {
    drawSavedBenchmarks();
  }
});

async function initializeEngine() {
  try {
    await bridge.initialize();
    bridgeReady = true;
    elements.engineStatus.textContent = "C engine ready";
    elements.engineDot.classList.add("engine-ready");
    updateRunControls(false, false);
  } catch (error) {
    elements.engineStatus.textContent = "Build required";
    elements.engineDot.classList.add("engine-offline");
    const notice = document.createElement("div");
    notice.className = "engine-notice";
    notice.setAttribute("role", "status");
    notice.innerHTML = `<span>!</span><p><strong>C / WebAssembly engine not built.</strong> Install Emscripten and run <code>npm run build:wasm</code>. No JavaScript fallback or sample timings are shown. See <a href="README.md">README.md</a>.</p>`;
    document.querySelector(".simulator-intro").append(notice);
    showToast(error.message, "error");
    updateRunControls(false, false);
  }
}

refreshGraphControls();
player.reset();
updateRunControls(false, false);
const initialPage = location.hash.slice(1);
if (initialPage) navigateTo(initialPage);
initializeEngine();
