import { edgeKey } from "./graph.js";

const EVENT_STYLE = {
  sort: ["↕", "sort-step"],
  initialize: ["◎", "init-step"],
  "kruskal-examine": ["◉", "inspect-step"],
  "kruskal-find": ["⌕", "find-step"],
  "kruskal-accept": ["✓", "accept-step"],
  "kruskal-reject": ["×", "reject-step"],
  "prim-start": ["↗", "init-step"],
  "prim-extract": ["↓", "inspect-step"],
  "prim-examine": ["⌕", "find-step"],
  "prim-update": ["↳", "update-step"],
  "prim-accept": ["✓", "accept-step"],
  "prim-skip": ["×", "reject-step"],
  disconnected: ["!", "reject-step"],
  complete: ["✓", "complete-step"]
};

function labelFor(vertices, id) {
  return vertices.find((vertex) => vertex.id === id)?.label ?? `#${id}`;
}

function describeEvent(event, vertices, algorithm) {
  const left = labelFor(vertices, event.a);
  const right = labelFor(vertices, event.b);
  switch (event.type) {
    case "sort": return `Sort ${event.a} edges by increasing weight.`;
    case "initialize": return `Initialize ${event.a} separate components.`;
    case "kruskal-examine": return `Examine ${left} — ${right} (weight ${event.weight}).`;
    case "kruskal-find": return `Find(${left}) → ${labelFor(vertices, event.x)} · Find(${right}) → ${labelFor(vertices, event.y)}.`;
    case "kruskal-accept": return `Union the components; accept ${left} — ${right} (+${event.weight}).`;
    case "kruskal-reject": return `Both endpoints share a component. Reject ${left} — ${right}; this would form a cycle.`;
    case "prim-start": return `Start a new component at vertex ${left}.`;
    case "prim-extract": return event.b < 0
      ? `Extract-min ${left} (root of this component).`
      : `Extract-min ${left} with key ${event.weight}; parent ${labelFor(vertices, event.b)}.`;
    case "prim-examine": return `Examine adjacent edge ${left} — ${right} (weight ${event.weight}).`;
    case "prim-update": return `Update key[${left}] = ${event.weight}; parent[${left}] = ${labelFor(vertices, event.b)}.`;
    case "prim-accept": return `Add parent edge ${left} — ${right} to the tree (+${event.weight}).`;
    case "prim-skip": return `Skip ${left} — ${right}; ${event.x ? "the neighbor is already in the tree." : "its key is not improved."}`;
    case "disconnected": return `Graph is disconnected: the result is a forest of ${event.a} components.`;
    case "complete": return event.x
      ? `${algorithm === "prim" ? "Prim" : "Kruskal"} complete. Minimum spanning tree found.`
      : `${algorithm === "prim" ? "Prim" : "Kruskal"} complete. Minimum spanning forest found.`;
    default: return "Algorithm operation complete.";
  }
}

export class TracePlayer {
  constructor({ svgGraph, traceList, stepCounter, totalWeight, edgeCount, componentCount,
    resultMessage, algorithmState, insight, onStep }) {
    this.svgGraph = svgGraph;
    this.traceList = traceList;
    this.stepCounter = stepCounter;
    this.totalWeight = totalWeight;
    this.edgeCount = edgeCount;
    this.componentCount = componentCount;
    this.resultMessage = resultMessage;
    this.algorithmState = algorithmState;
    this.insight = insight;
    this.onStep = onStep;
    this.events = [];
    this.vertices = [];
    this.algorithm = "kruskal";
    this.index = 0;
  }

  reset() {
    this.events = [];
    this.vertices = [];
    this.index = 0;
    this.svgGraph.setHighlights(new Map());
    this.traceList.innerHTML = `<div class="trace-empty"><span>⌁</span><p>Your algorithm trace will appear here.</p><small>Select an algorithm and press Run.</small></div>`;
    this.stepCounter.textContent = "0 / 0";
    this.totalWeight.textContent = "—";
    this.edgeCount.innerHTML = `0 <small>/ 0</small>`;
    this.componentCount.textContent = "—";
    this.resultMessage.textContent = "Run an algorithm to construct the minimum spanning forest.";
    this.algorithmState.textContent = "Ready to run";
    this.insight.textContent = "Each green edge is accepted into the growing minimum spanning forest. Red edges would create a cycle.";
    this.onStep(false, false);
  }

  load(result, algorithm, vertices) {
    this.events = result.events;
    this.algorithm = algorithm;
    this.vertices = vertices;
    this.index = 0;
    this.svgGraph.setHighlights(new Map());
    this.totalWeight.textContent = "0";
    this.edgeCount.innerHTML = `0 <small>/ ${Math.max(0, vertices.length - 1)}</small>`;
    this.componentCount.textContent = String(vertices.length);
    this.resultMessage.textContent = "Algorithm ready. Step through its C execution trace.";
    this.algorithmState.textContent = "Trace loaded · step to begin";
    this.render();
    this.onStep(this.events.length > 0, this.events.length > 0);
  }

  step() {
    if (this.index >= this.events.length) return false;
    const event = this.events[this.index];
    this.applyEvent(event);
    this.index += 1;
    this.render();
    const complete = this.index >= this.events.length;
    this.onStep(!complete, true);
    return true;
  }

  applyEvent(event) {
    const highlights = new Map(this.svgGraph.highlightedEdges);
    let active = null;
    const mark = (u, v, state) => {
      const key = edgeKey(u, v);
      highlights.set(key, state);
      active = key;
      return key;
    };
    if (event.type === "kruskal-examine" || event.type === "kruskal-find") {
      active = edgeKey(event.a, event.b);
      this.insight.textContent = event.type === "kruskal-find"
        ? `Find compares the component roots: ${labelFor(this.vertices, event.x)} and ${labelFor(this.vertices, event.y)}.`
        : "Kruskal considers edges in nondecreasing weight order.";
    } else if (event.type === "kruskal-accept" || event.type === "prim-accept") {
      mark(event.a, event.b, "edge-accepted");
      this.insight.textContent = `${labelFor(this.vertices, event.a)} — ${labelFor(this.vertices, event.b)} is safe to add; it joins separate tree components.`;
    } else if (event.type === "kruskal-reject" || event.type === "prim-skip") {
      mark(event.a, event.b, "edge-rejected");
      this.insight.textContent = event.type === "prim-skip" && !event.x
        ? "This edge did not improve the neighboring vertex’s current key."
        : "The edge is rejected because the endpoints are already connected; adding it would create a cycle.";
    } else if (event.type === "prim-examine" || event.type === "prim-update") {
      active = edgeKey(event.a, event.b);
      this.insight.textContent = event.type === "prim-update"
        ? `A cheaper connection was found. The key of ${labelFor(this.vertices, event.a)} is now ${event.weight}.`
        : "Prim examines an adjacent edge and compares its weight with the vertex’s current key.";
    } else if (event.type === "prim-extract") {
      if (event.b >= 0) mark(event.b, event.a, "edge-accepted");
      this.insight.textContent = event.b >= 0
        ? `The minimum-key vertex ${labelFor(this.vertices, event.a)} joins the tree through its parent edge.`
        : `Vertex ${labelFor(this.vertices, event.a)} roots a new component.`;
    }
    this.svgGraph.setHighlights(highlights, active);
    this.totalWeight.textContent = String(event.total);
    this.edgeCount.innerHTML = `${event.selected} <small>/ ${Math.max(0, this.vertices.length - 1)}</small>`;
    if (event.type === "complete" || event.type === "disconnected") {
      const components = event.type === "disconnected" ? event.a : event.a;
      this.componentCount.textContent = String(components);
      this.resultMessage.textContent = components === 1
        ? "A minimum spanning tree connects every vertex at minimum total weight."
        : `Minimum spanning forest found across ${components} disconnected components.`;
    } else if (event.type === "kruskal-accept" || event.type === "prim-accept") {
      this.componentCount.textContent = String(Math.max(1, this.vertices.length - event.selected));
    }
    this.algorithmState.textContent = event.type === "complete" || event.type === "disconnected"
      ? "Execution complete"
      : `Step ${this.index + 1} · ${this.algorithm === "prim" ? "Prim" : "Kruskal"}`;
  }

  render() {
    this.stepCounter.textContent = `${this.index} / ${this.events.length}`;
    const first = Math.max(0, this.index - 6);
    const visible = this.events.slice(first, this.index);
    if (visible.length === 0) {
      this.traceList.innerHTML = `<div class="trace-empty"><span>⌁</span><p>Algorithm trace loaded.</p><small>Use Next step or Play to begin.</small></div>`;
      return;
    }
    this.traceList.innerHTML = visible.map((event, offset) => {
      const actualIndex = first + offset;
      const [icon, style] = EVENT_STYLE[event.type] ?? ["·", ""];
      const current = actualIndex === this.index - 1;
      const description = describeEvent(event, this.vertices, this.algorithm);
      return `<div class="trace-item ${style} ${current ? "trace-current" : ""}"><span class="trace-icon">${icon}</span><div><p>${description}</p><small>${actualIndex + 1} / ${this.events.length}</small></div></div>`;
    }).join("");
    this.traceList.scrollTop = this.traceList.scrollHeight;
  }
}
