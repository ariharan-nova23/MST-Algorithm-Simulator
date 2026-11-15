#include "mst.h"

#include <stddef.h>
#include <stdlib.h>

int mst_result_total = 0;
int mst_result_count = 0;
int mst_result_components = 0;
UfStats mst_uf_stats = {0, 0, 0, 0};

static volatile int benchmark_sink = 0;

int run_kruskal(const MstEdge *edges, int vertices, int edge_count,
                MstEvent *events, int event_capacity) {
  return mst_kruskal_internal(edges, vertices, edge_count, events, event_capacity);
}

int run_prim(const MstEdge *edges, int vertices, int edge_count, int start_vertex,
             MstEvent *events, int event_capacity) {
  return mst_prim_internal(edges, vertices, edge_count, start_vertex, events, event_capacity);
}

int benchmark_kruskal(const MstEdge *edges, int vertices, int edge_count, int repeats) {
  int result = 0;
  if (repeats < 1) return -1;
  for (int i = 0; i < repeats; ++i) {
    result = mst_kruskal_internal(edges, vertices, edge_count, NULL, 0);
    if (result < 0) return result;
    benchmark_sink ^= mst_result_total + mst_result_count + mst_result_components;
  }
  return result;
}

int benchmark_prim(const MstEdge *edges, int vertices, int edge_count, int start_vertex,
                   int repeats) {
  int result = 0;
  if (repeats < 1) return -1;
  for (int i = 0; i < repeats; ++i) {
    result = mst_prim_internal(edges, vertices, edge_count, start_vertex, NULL, 0);
    if (result < 0) return result;
    benchmark_sink ^= mst_result_total + mst_result_count + mst_result_components;
  }
  return result;
}

int benchmark_uf(const MstEdge *edges, int vertices, int edge_count, int variant,
                 int repeats) {
  if (edges == NULL || vertices < 1 || edge_count < 0 || variant < UF_NAIVE ||
      variant > UF_RANK_COMPRESSION || repeats < 1) return -1;

  int *parent = (int *)malloc((size_t)vertices * sizeof(int));
  int *rank = (int *)calloc((size_t)vertices, sizeof(int));
  if (parent == NULL || rank == NULL) {
    free(parent);
    free(rank);
    return -3;
  }

  for (int repeat = 0; repeat < repeats; ++repeat) {
    for (int i = 0; i < vertices; ++i) {
      parent[i] = i;
      rank[i] = 0;
    }
    mst_uf_stats.find_calls = 0;
    mst_uf_stats.union_calls = 0;
    mst_uf_stats.parent_hops = 0;
    mst_uf_stats.max_depth = 0;
    for (int i = 0; i < edge_count; ++i) {
      if (edges[i].u < 0 || edges[i].u >= vertices ||
          edges[i].v < 0 || edges[i].v >= vertices) {
        free(parent);
        free(rank);
        return -1;
      }
      uf_union(parent, rank, edges[i].u, edges[i].v, variant);
    }
  }

  for (int i = 0; i < vertices; ++i) {
    int depth = 0;
    int current = i;
    while (parent[current] != current && depth <= vertices) {
      current = parent[current];
      ++depth;
    }
    if (depth > mst_uf_stats.max_depth) mst_uf_stats.max_depth = depth;
  }
  benchmark_sink ^= mst_uf_stats.find_calls + mst_uf_stats.parent_hops +
                    mst_uf_stats.max_depth;
  free(parent);
  free(rank);
  return 0;
}

int get_result_total(void) { return mst_result_total; }
int get_result_count(void) { return mst_result_count; }
int get_result_components(void) { return mst_result_components; }
int get_uf_find_calls(void) { return mst_uf_stats.find_calls; }
int get_uf_union_calls(void) { return mst_uf_stats.union_calls; }
int get_uf_hops(void) { return mst_uf_stats.parent_hops; }
int get_uf_max_depth(void) { return mst_uf_stats.max_depth; }
