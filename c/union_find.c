#include "mst.h"

static int find_without_compression(int *parent, int value) {
  int root = value;
  while (parent[root] != root) {
    ++mst_uf_stats.parent_hops;
    root = parent[root];
  }
  return root;
}

static int find_with_compression(int *parent, int value) {
  int root = value;
  while (parent[root] != root) {
    ++mst_uf_stats.parent_hops;
    root = parent[root];
  }
  while (parent[value] != value) {
    int next = parent[value];
    parent[value] = root;
    value = next;
  }
  return root;
}

int uf_find(int *parent, int *rank, int value, int variant) {
  (void)rank;
  ++mst_uf_stats.find_calls;
  if (variant == UF_COMPRESSION || variant == UF_RANK_COMPRESSION) {
    return find_with_compression(parent, value);
  }
  return find_without_compression(parent, value);
}

int uf_union_roots(int *parent, int *rank, int left_root, int right_root, int variant) {
  ++mst_uf_stats.union_calls;
  if (left_root == right_root) return 0;

  if (variant == UF_RANK || variant == UF_RANK_COMPRESSION) {
    if (rank[left_root] < rank[right_root]) {
      parent[left_root] = right_root;
    } else if (rank[left_root] > rank[right_root]) {
      parent[right_root] = left_root;
    } else {
      parent[right_root] = left_root;
      ++rank[left_root];
    }
  } else {
    parent[right_root] = left_root;
  }
  return 1;
}

int uf_union(int *parent, int *rank, int left, int right, int variant) {
  int left_root = uf_find(parent, rank, left, variant);
  int right_root = uf_find(parent, rank, right, variant);
  return uf_union_roots(parent, rank, left_root, right_root, variant);
}
