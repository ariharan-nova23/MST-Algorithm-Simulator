#ifndef MST_H
#define MST_H

#include <stdint.h>

typedef struct {
  int32_t u;
  int32_t v;
  int32_t weight;
} MstEdge;

typedef struct {
  int32_t kind;
  int32_t a;
  int32_t b;
  int32_t weight;
  int32_t total;
  int32_t selected;
  int32_t x;
  int32_t y;
} MstEvent;

enum {
  MST_EVENT_SORT = 1,
  MST_EVENT_INITIALIZE,
  MST_EVENT_KRUSKAL_EXAMINE,
  MST_EVENT_KRUSKAL_FIND,
  MST_EVENT_KRUSKAL_ACCEPT,
  MST_EVENT_KRUSKAL_REJECT,
  MST_EVENT_COMPLETE,
  MST_EVENT_DISCONNECTED,
  MST_EVENT_PRIM_START,
  MST_EVENT_PRIM_EXTRACT,
  MST_EVENT_PRIM_EXAMINE,
  MST_EVENT_PRIM_UPDATE,
  MST_EVENT_PRIM_ACCEPT,
  MST_EVENT_PRIM_SKIP
};

enum {
  UF_NAIVE = 0,
  UF_RANK,
  UF_COMPRESSION,
  UF_RANK_COMPRESSION
};

typedef struct {
  int find_calls;
  int union_calls;
  int parent_hops;
  int max_depth;
} UfStats;

extern int mst_result_total;
extern int mst_result_count;
extern int mst_result_components;
extern UfStats mst_uf_stats;

int mst_kruskal_internal(const MstEdge *edges, int vertices, int edge_count,
                         MstEvent *events, int event_capacity);
int mst_prim_internal(const MstEdge *edges, int vertices, int edge_count,
                      int start_vertex, MstEvent *events, int event_capacity);
int run_kruskal(const MstEdge *edges, int vertices, int edge_count,
                MstEvent *events, int event_capacity);
int run_prim(const MstEdge *edges, int vertices, int edge_count, int start_vertex,
             MstEvent *events, int event_capacity);
int benchmark_uf(const MstEdge *edges, int vertices, int edge_count, int variant,
                 int repeats);
int uf_find(int *parent, int *rank, int value, int variant);
int uf_union_roots(int *parent, int *rank, int left_root, int right_root, int variant);
int uf_union(int *parent, int *rank, int left, int right, int variant);

#endif
