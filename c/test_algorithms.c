#include "mst.h"

#include <stdio.h>
#include <stdlib.h>

static void require(int condition, const char *message) {
  if (!condition) {
    fprintf(stderr, "FAIL: %s\n", message);
    exit(EXIT_FAILURE);
  }
}

int main(void) {
  const MstEdge sample[] = {
    {0, 1, 1}, {1, 2, 2}, {0, 2, 3}, {2, 3, 4}, {1, 3, 5}
  };
  MstEvent trace[64];
  int count = run_kruskal(sample, 4, 5, trace, 64);
  require(count > 0, "Kruskal returns a trace");
  require(mst_result_total == 7 && mst_result_count == 3 &&
          mst_result_components == 1, "Kruskal returns the expected sample MST");
  require(mst_uf_stats.find_calls == 8 && mst_uf_stats.union_calls == 3,
          "Kruskal calls Union only for accepted edges");
  count = run_prim(sample, 4, 5, 0, trace, 64);
  require(count > 0, "Prim returns a trace");
  require(mst_result_total == 7 && mst_result_count == 3 &&
          mst_result_components == 1, "Prim returns the expected sample MST");

  const MstEdge disconnected[] = {{0, 1, -3}, {2, 3, 4}};
  count = run_kruskal(disconnected, 5, 2, trace, 64);
  require(count > 0 && mst_result_total == 1 && mst_result_count == 2 &&
          mst_result_components == 3, "Kruskal reports a disconnected minimum forest");
  count = run_prim(disconnected, 5, 2, 2, trace, 64);
  require(count > 0 && mst_result_total == 1 && mst_result_count == 2 &&
          mst_result_components == 3, "Prim reports a disconnected minimum forest");

  MstEdge chain[110];
  int chain_count = 0;
  for (int vertex = 0; vertex < 63; ++vertex) {
    chain[chain_count++] = (MstEdge){vertex + 1, vertex, 1};
  }
  for (int i = 0; i < 32; ++i) chain[chain_count++] = (MstEdge){0, 63, 1};
  int naive_hops = 0;
  int naive_depth = 0;
  int rank_depth = 0;
  int compressed_hops = 0;
  for (int variant = UF_NAIVE; variant <= UF_RANK_COMPRESSION; ++variant) {
    require(benchmark_uf(chain, 64, chain_count, variant, 1) == 0,
            "Union-Find benchmark accepts the workload");
    require(mst_uf_stats.find_calls == chain_count * 2 &&
            mst_uf_stats.union_calls == chain_count, "Union-Find operation counters are exact");
    if (variant == UF_NAIVE) {
      naive_hops = mst_uf_stats.parent_hops;
      naive_depth = mst_uf_stats.max_depth;
    } else if (variant == UF_RANK) {
      rank_depth = mst_uf_stats.max_depth;
    } else if (variant == UF_COMPRESSION) {
      compressed_hops = mst_uf_stats.parent_hops;
    }
  }
  require(rank_depth < naive_depth, "Union by rank limits tree depth");
  require(compressed_hops < naive_hops, "Path compression reduces parent traversals");
  return EXIT_SUCCESS;
}
