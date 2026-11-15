const CANVAS_WIDTH = 760;
const CANVAS_HEIGHT = 430;
const MAX_VERTICES = 64;

const edgeKey = (u, v) => [u, v].sort((a, b) => a - b).join(":");

function makeVertices(count, labels = null) {
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;
  const radius = Math.min(150, 115 + count * 5);
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(count, 1);
    return {
      id: index,
      label: labels?.[index] ?? (index < 26 ? String.fromCharCode(65 + index) : `V${index + 1}`),
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };
  });
}

function unusedVertexLabel(vertices) {
  const used = new Set(vertices.map((vertex) => vertex.label));
  for (let index = 0; index < 26; index++) {
    const label = String.fromCharCode(65 + index);
    if (!used.has(label)) return label;
  }
  let suffix = vertices.length + 1;
  while (used.has(`V${suffix}`)) suffix++;
  return `V${suffix}`;
}

export function sampleGraph(name = "sample") {
  if (name === "city") {
    const vertices = makeVertices(7, ["North", "Harbor", "Market", "Central", "East", "South", "West"]);
    return {
      vertices,
      edges: [
        { u: 0, v: 1, weight: 4 }, { u: 0, v: 2, weight: 8 },
        { u: 1, v: 2, weight: 3 }, { u: 1, v: 3, weight: 6 },
        { u: 2, v: 3, weight: 2 }, { u: 2, v: 4, weight: 7 },
        { u: 3, v: 4, weight: 4 }, { u: 3, v: 5, weight: 9 },
        { u: 4, v: 5, weight: 3 }, { u: 4, v: 6, weight: 5 },
        { u: 5, v: 6, weight: 2 }
      ]
    };
  }
  if (name === "islands") {
    return {
      vertices: makeVertices(6),
      edges: [
        { u: 0, v: 1, weight: 2 }, { u: 1, v: 2, weight: 1 },
        { u: 3, v: 4, weight: 3 }, { u: 4, v: 5, weight: 2 },
        { u: 3, v: 5, weight: 6 }
      ]
    };
  }
  return {
    vertices: makeVertices(4),
    edges: [
      { u: 0, v: 1, weight: 1 }, { u: 1, v: 2, weight: 2 },
      { u: 0, v: 2, weight: 3 }, { u: 2, v: 3, weight: 4 },
      { u: 1, v: 3, weight: 5 }
    ]
  };
}

export function createRandomGraph(vertexCount = 8) {
  const count = Math.max(2, Math.min(MAX_VERTICES, vertexCount));
  const vertices = makeVertices(count);
  const edges = [];
  const included = new Set();
  const add = (u, v) => {
    const key = edgeKey(u, v);
    if (included.has(key)) return;
    included.add(key);
    edges.push({ u, v, weight: 1 + Math.floor(Math.random() * 30) });
  };
  for (let vertex = 1; vertex < count; vertex++) {
    add(vertex, Math.floor(Math.random() * vertex));
  }
  const target = Math.min((count * (count - 1)) / 2, count + Math.floor(count * 0.8));
  while (edges.length < target) {
    const u = Math.floor(Math.random() * count);
    const v = Math.floor(Math.random() * count);
    if (u !== v) add(u, v);
  }
  return { vertices, edges };
}

export class GraphEditor {
  constructor(svg, onChange, onSelection, onConnect) {
    this.svg = svg;
    this.onChange = onChange;
    this.onSelection = onSelection;
    this.onConnect = onConnect;
    this.vertices = [];
    this.edges = [];
    this.highlightedEdges = new Map();
    this.activeEdge = null;
    this.selectedVertex = null;
    this.selectedEdge = null;
    this.tool = "select";
    this.connectVertex = null;
    this.dragging = null;
    this.svg.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
    this.svg.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    this.svg.addEventListener("pointerup", () => { this.dragging = null; });
    this.svg.addEventListener("pointercancel", () => { this.dragging = null; });
    this.svg.addEventListener("click", (event) => this.handleClick(event));
    this.setGraph(sampleGraph());
  }

  setGraph(graph) {
    this.vertices = graph.vertices.map((vertex) => ({ ...vertex }));
    this.edges = graph.edges.map((edge) => ({ ...edge }));
    this.highlightedEdges.clear();
    this.activeEdge = null;
    this.selectedVertex = null;
    this.selectedEdge = null;
    this.connectVertex = null;
    this.render();
    this.notifyChange();
    this.notifySelection();
  }

  notifyChange() {
    this.onChange({ vertices: this.vertices, edges: this.edges });
  }

  notifySelection() {
    this.onSelection({
      vertex: this.vertices.find((vertex) => vertex.id === this.selectedVertex) ?? null,
      edge: this.selectedEdge === null ? null : this.edges[this.selectedEdge] ?? null
    });
  }

  setTool(tool) {
    this.tool = tool;
    this.connectVertex = null;
    this.render();
  }

  setHighlights(edgeHighlights, activeEdge = null) {
    this.highlightedEdges = new Map(edgeHighlights);
    this.activeEdge = activeEdge;
    this.render();
  }

  addVertex() {
    if (this.vertices.length >= MAX_VERTICES) return false;
    const id = this.vertices.reduce((maximum, vertex) => Math.max(maximum, vertex.id), -1) + 1;
    const angle = Math.random() * Math.PI * 2;
    this.vertices.push({
      id,
      label: unusedVertexLabel(this.vertices),
      x: CANVAS_WIDTH / 2 + Math.cos(angle) * 80,
      y: CANVAS_HEIGHT / 2 + Math.sin(angle) * 80
    });
    this.render();
    this.notifyChange();
    this.notifySelection();
    return true;
  }

  deleteVertex(id) {
    this.vertices = this.vertices.filter((vertex) => vertex.id !== id);
    this.edges = this.edges.filter((edge) => edge.u !== id && edge.v !== id);
    const remappedIds = new Map(this.vertices.map((vertex, index) => [vertex.id, index]));
    this.vertices.forEach((vertex, index) => { vertex.id = index; });
    this.edges.forEach((edge) => {
      edge.u = remappedIds.get(edge.u);
      edge.v = remappedIds.get(edge.v);
    });
    this.selectedVertex = null;
    this.selectedEdge = null;
    this.render();
    this.notifyChange();
    this.notifySelection();
  }

  addEdge(u, v, weight) {
    if (u === v) return "A vertex cannot connect to itself.";
    if (!this.vertices.some((vertex) => vertex.id === u) || !this.vertices.some((vertex) => vertex.id === v)) {
      return "Choose two existing vertices.";
    }
    if (this.edges.some((edge) => edgeKey(edge.u, edge.v) === edgeKey(u, v))) {
      return "An edge between these vertices already exists.";
    }
    if (!Number.isInteger(weight) || weight < -9999 || weight > 9999) {
      return "Enter an integer edge weight between −9999 and 9999.";
    }
    this.edges.push({ u, v, weight });
    this.selectedEdge = this.edges.length - 1;
    this.render();
    this.notifyChange();
    this.notifySelection();
    return null;
  }

  updateSelectedEdgeWeight(weight) {
    if (this.selectedEdge === null || !this.edges[this.selectedEdge]) return "Select an edge first.";
    if (!Number.isInteger(weight) || weight < -9999 || weight > 9999) {
      return "Enter an integer edge weight between −9999 and 9999.";
    }
    this.edges[this.selectedEdge].weight = weight;
    this.render();
    this.notifyChange();
    this.notifySelection();
    return null;
  }

  deleteSelectedEdge() {
    if (this.selectedEdge === null) return "Select an edge first.";
    this.edges.splice(this.selectedEdge, 1);
    this.selectedEdge = null;
    this.highlightedEdges.clear();
    this.render();
    this.notifyChange();
    this.notifySelection();
    return null;
  }

  clear() {
    this.vertices = [];
    this.edges = [];
    this.highlightedEdges.clear();
    this.activeEdge = null;
    this.selectedEdge = null;
    this.selectedVertex = null;
    this.render();
    this.notifyChange();
    this.notifySelection();
  }

  selectEdge(index) {
    this.selectedEdge = index;
    this.selectedVertex = null;
    this.render();
    this.notifySelection();
  }

  selectVertex(id) {
    this.selectedVertex = id;
    this.selectedEdge = null;
    this.render();
    this.notifySelection();
  }

  getEdgeKey(edge) {
    return edgeKey(edge.u, edge.v);
  }

  coordinatesFromEvent(event) {
    const bounds = this.svg.getBoundingClientRect();
    return {
      x: Math.max(23, Math.min(CANVAS_WIDTH - 23, (event.clientX - bounds.left) * CANVAS_WIDTH / bounds.width)),
      y: Math.max(23, Math.min(CANVAS_HEIGHT - 23, (event.clientY - bounds.top) * CANVAS_HEIGHT / bounds.height))
    };
  }

  handlePointerDown(event) {
    const node = event.target.closest("[data-vertex]");
    if (!node || this.tool !== "select") return;
    const id = Number(node.dataset.vertex);
    this.dragging = { id, moved: false };
    if (this.svg.setPointerCapture) this.svg.setPointerCapture(event.pointerId);
  }

  handlePointerMove(event) {
    if (!this.dragging) return;
    const vertex = this.vertices.find((item) => item.id === this.dragging.id);
    if (!vertex) return;
    const point = this.coordinatesFromEvent(event);
    if (Math.abs(vertex.x - point.x) + Math.abs(vertex.y - point.y) > 2) this.dragging.moved = true;
    vertex.x = point.x;
    vertex.y = point.y;
    this.render();
  }

  handleClick(event) {
    const edgeElement = event.target.closest("[data-edge]");
    if (edgeElement && this.tool === "select" && !this.dragging?.moved) {
      this.selectEdge(Number(edgeElement.dataset.edge));
      return;
    }
    const node = event.target.closest("[data-vertex]");
    if (!node) {
      if (this.tool === "select") {
        this.selectedVertex = null;
        this.selectedEdge = null;
        this.render();
        this.notifySelection();
      }
      return;
    }
    const id = Number(node.dataset.vertex);
    if (this.tool === "connect") {
      if (this.connectVertex === null) {
        this.connectVertex = id;
        this.selectedVertex = id;
        this.render();
      } else {
        const from = this.connectVertex;
        this.connectVertex = null;
        if (from !== id) this.onConnect(from, id);
        else this.render();
      }
      return;
    }
    if (!this.dragging?.moved) this.selectVertex(id);
    this.dragging = null;
  }

  render() {
    const pointById = new Map(this.vertices.map((vertex) => [vertex.id, vertex]));
    const edgeMarkup = this.edges.map((edge, index) => {
      const from = pointById.get(edge.u);
      const to = pointById.get(edge.v);
      if (!from || !to) return "";
      const key = edgeKey(edge.u, edge.v);
      const state = this.highlightedEdges.get(key) ?? "";
      const active = this.activeEdge === key;
      const selected = this.selectedEdge === index;
      const middleX = (from.x + to.x) / 2;
      const middleY = (from.y + to.y) / 2;
      const weight = String(edge.weight).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      return `<g class="graph-edge ${state} ${active ? "edge-active" : ""} ${selected ? "edge-selected" : ""}" data-edge="${index}"><line class="edge-hit" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/><line class="edge-line" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/><rect class="edge-label-bg" x="${middleX - 18}" y="${middleY - 12}" width="36" height="24" rx="8"/><text class="edge-label" x="${middleX}" y="${middleY + 4}">${weight}</text></g>`;
    }).join("");
    const vertexMarkup = this.vertices.map((vertex) => {
      const selected = this.selectedVertex === vertex.id;
      return `<g class="graph-node ${selected ? "node-selected" : ""}" data-vertex="${vertex.id}" transform="translate(${vertex.x} ${vertex.y})" tabindex="0" role="button" aria-label="Vertex ${vertex.label}"><circle class="node-halo" r="20"/><circle class="node-circle" r="15"/><text class="node-label" y="4">${vertex.label}</text></g>`;
    }).join("");
    this.svg.innerHTML = `<defs><pattern id="canvas-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#263147" opacity=".58"/></pattern></defs><rect class="canvas-bg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#canvas-dots)"/>${edgeMarkup}${vertexMarkup}`;
  }
}

export { edgeKey };
