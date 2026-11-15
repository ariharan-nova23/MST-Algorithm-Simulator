#include "mst.h"

#include <stdlib.h>

static int compare_edges(const void *left, const void *right) {
  const MstEdge *a = (const MstEdge *)left;
  const MstEdge *b = (const MstEdge *)right;
  if (a->weight < b->weight) return -1;
  if (a->weight > b->weight) return 1;
  if (a->u < b->u) return -1;
  if (a->u > b->u) return 1;
  if (a->v < b->v) return -1;
  if (a->v > b->v) return 1;
  return 0;
}

static int emit_event(MstEvent *events, int capacity, int *count, int kind,
                      int a, int b, int weight, int total, int selected,
                      int x, int y) {
  if (events == NULL) return 0;
  if (*count >= capacity) return -2;
  events[*count].kind = kind;
  events[*count].a = a;
  events[*count].b = b;
  events[*count].weight = weight;
  events[*count].total = total;
  events[*count].selected = selected;
  events[*count].x = x;
  events[*count].y = y;
  ++*count;
  return 0;
}

int mst_kruskal_internal(const MstEdge *edges, int vertices, int edge_count,
                         MstEvent *events, int event_capacity) {
  if (edges == NULL || vertices < 1 || edge_count < 0 || event_capacity < 0) return -1;
  if (edge_count > 0) {
    for (int i = 0; i < edge_count; ++i) {
      if (edges[i].u < 0 || edges[i].u >= vertices ||
          edges[i].v < 0 || edges[i].v >= vertices || edges[i].u == edges[i].v) return -1;
    }
  }

  MstEdge *sorted = NULL;
  int *parent = (int *)malloc((size_t)vertices * sizeof(int));
  int *rank = (int *)calloc((size_t)vertices, sizeof(int));
  if (edge_count > 0) sorted = (MstEdge *)malloc((size_t)edge_count * sizeof(MstEdge));
  if (parent == NULL || rank == NULL || (edge_count > 0 && sorted == NULL)) {
    free(sorted);
    free(parent);
    free(rank);
    return -3;
  }

  for (int i = 0; i < vertices; ++i) parent[i] = i;
  if (edge_count > 0) {
    for (int i = 0; i < edge_count; ++i) sorted[i] = edges[i];
    qsort(sorted, (size_t)edge_count, sizeof(MstEdge), compare_edges);
  }

  int event_count = 0;
  int total = 0;
  int selected = 0;
  int components = vertices;
  int status = emit_event(events, event_capacity, &event_count, MST_EVENT_SORT,
                          edge_count, 0, 0, total, selected, 0, 0);
  if (status == 0) {
    status = emit_event(events, event_capacity, &event_count, MST_EVENT_INITIALIZE,
                        vertices, 0, 0, total, selected, components, 0);
  }
  mst_uf_stats.find_calls = 0;
  mst_uf_stats.union_calls = 0;
  mst_uf_stats.parent_hops = 0;
  mst_uf_stats.max_depth = 0;

  for (int i = 0; i < edge_count && selected < vertices - 1 && status == 0; ++i) {
    MstEdge edge = sorted[i];
    status = emit_event(events, event_capacity, &event_count, MST_EVENT_KRUSKAL_EXAMINE,
                        edge.u, edge.v, edge.weight, total, selected, i, 0);
    if (status != 0) break;
    int root_u = uf_find(parent, rank, edge.u, UF_RANK_COMPRESSION);
    int root_v = uf_find(parent, rank, edge.v, UF_RANK_COMPRESSION);
    status = emit_event(events, event_capacity, &event_count, MST_EVENT_KRUSKAL_FIND,
                        edge.u, edge.v, edge.weight, total, selected, root_u, root_v);
    if (status != 0) break;
    if (root_u == root_v) {
      status = emit_event(events, event_capacity, &event_count, MST_EVENT_KRUSKAL_REJECT,
                          edge.u, edge.v, edge.weight, total, selected, root_u, root_v);
    } else {
      if (!uf_union_roots(parent, rank, root_u, root_v, UF_RANK_COMPRESSION)) {
        status = -1;
        break;
      }
      total += edge.weight;
      ++selected;
      --components;
      status = emit_event(events, event_capacity, &event_count, MST_EVENT_KRUSKAL_ACCEPT,
                          edge.u, edge.v, edge.weight, total, selected, root_u, root_v);
    }
  }

  if (status == 0 && components > 1) {
    status = emit_event(events, event_capacity, &event_count, MST_EVENT_DISCONNECTED,
                        components, 0, 0, total, selected, 0, 0);
  }
  if (status == 0) {
    status = emit_event(events, event_capacity, &event_count, MST_EVENT_COMPLETE,
                        components, 0, 0, total, selected, selected == vertices - 1, 0);
  }

  mst_result_total = total;
  mst_result_count = selected;
  mst_result_components = components;
  free(sorted);
  free(parent);
  free(rank);
  if (status != 0) return status;
  return event_count;
}
