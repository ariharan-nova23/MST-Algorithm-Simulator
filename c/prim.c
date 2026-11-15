#include "mst.h"

#include <stdlib.h>

#define MST_INFINITY 0x3fffffff

typedef struct {
  int to;
  int weight;
  int next;
} AdjNode;

typedef struct {
  int *items;
  int *position;
  int *key;
  int size;
} MinHeap;

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

static void heap_swap(MinHeap *heap, int left, int right) {
  int temp = heap->items[left];
  heap->items[left] = heap->items[right];
  heap->items[right] = temp;
  heap->position[heap->items[left]] = left;
  heap->position[heap->items[right]] = right;
}

static void sift_up(MinHeap *heap, int index) {
  while (index > 0) {
    int parent = (index - 1) / 2;
    if (heap->key[heap->items[parent]] <= heap->key[heap->items[index]]) break;
    heap_swap(heap, parent, index);
    index = parent;
  }
}

static void sift_down(MinHeap *heap, int index) {
  for (;;) {
    int left = index * 2 + 1;
    int right = left + 1;
    int smallest = index;
    if (left < heap->size &&
        heap->key[heap->items[left]] < heap->key[heap->items[smallest]]) smallest = left;
    if (right < heap->size &&
        heap->key[heap->items[right]] < heap->key[heap->items[smallest]]) smallest = right;
    if (smallest == index) break;
    heap_swap(heap, index, smallest);
    index = smallest;
  }
}

static void heap_insert_or_decrease(MinHeap *heap, int vertex) {
  int position = heap->position[vertex];
  if (position < 0) {
    position = heap->size++;
    heap->items[position] = vertex;
    heap->position[vertex] = position;
  }
  sift_up(heap, position);
}

static int heap_extract_min(MinHeap *heap) {
  int result = heap->items[0];
  heap->position[result] = -1;
  --heap->size;
  if (heap->size > 0) {
    heap->items[0] = heap->items[heap->size];
    heap->position[heap->items[0]] = 0;
    sift_down(heap, 0);
  }
  return result;
}

int mst_prim_internal(const MstEdge *edges, int vertices, int edge_count,
                      int start_vertex, MstEvent *events, int event_capacity) {
  if (edges == NULL || vertices < 1 || edge_count < 0 || event_capacity < 0 ||
      start_vertex < 0 || start_vertex >= vertices) return -1;
  for (int i = 0; i < edge_count; ++i) {
    if (edges[i].u < 0 || edges[i].u >= vertices ||
        edges[i].v < 0 || edges[i].v >= vertices || edges[i].u == edges[i].v) return -1;
  }

  int *heads = (int *)malloc((size_t)vertices * sizeof(int));
  int *keys = (int *)malloc((size_t)vertices * sizeof(int));
  int *parents = (int *)malloc((size_t)vertices * sizeof(int));
  int *visited = (int *)calloc((size_t)vertices, sizeof(int));
  int *heap_items = (int *)malloc((size_t)vertices * sizeof(int));
  int *heap_positions = (int *)malloc((size_t)vertices * sizeof(int));
  AdjNode *adjacency = edge_count > 0
      ? (AdjNode *)malloc((size_t)edge_count * 2U * sizeof(AdjNode)) : NULL;
  if (heads == NULL || keys == NULL || parents == NULL || visited == NULL ||
      heap_items == NULL || heap_positions == NULL ||
      (edge_count > 0 && adjacency == NULL)) {
    free(heads); free(keys); free(parents); free(visited);
    free(heap_items); free(heap_positions); free(adjacency);
    return -3;
  }

  for (int i = 0; i < vertices; ++i) {
    heads[i] = -1;
    keys[i] = MST_INFINITY;
    parents[i] = -1;
    heap_positions[i] = -1;
  }
  int adjacency_count = 0;
  for (int i = 0; i < edge_count; ++i) {
    adjacency[adjacency_count].to = edges[i].v;
    adjacency[adjacency_count].weight = edges[i].weight;
    adjacency[adjacency_count].next = heads[edges[i].u];
    heads[edges[i].u] = adjacency_count++;
    adjacency[adjacency_count].to = edges[i].u;
    adjacency[adjacency_count].weight = edges[i].weight;
    adjacency[adjacency_count].next = heads[edges[i].v];
    heads[edges[i].v] = adjacency_count++;
  }

  MinHeap heap = {heap_items, heap_positions, keys, 0};
  int event_count = 0;
  int total = 0;
  int selected = 0;
  int components = 0;
  int next_start = start_vertex;
  int status = 0;

  while (selected + components < vertices && status == 0) {
    if (heap.size == 0) {
      int root = next_start;
      if (visited[root]) {
        root = -1;
        for (int i = 0; i < vertices; ++i) {
          if (!visited[i]) {
            root = i;
            break;
          }
        }
      }
      if (root < 0) break;
      next_start = root;
      ++components;
      keys[root] = 0;
      parents[root] = -1;
      heap_insert_or_decrease(&heap, root);
      status = emit_event(events, event_capacity, &event_count, MST_EVENT_PRIM_START,
                          root, -1, 0, total, selected, components, 0);
      if (status != 0) break;
    }

    int vertex = heap_extract_min(&heap);
    if (visited[vertex]) continue;
    visited[vertex] = 1;
    status = emit_event(events, event_capacity, &event_count, MST_EVENT_PRIM_EXTRACT,
                        vertex, parents[vertex], keys[vertex], total, selected,
                        components, 0);
    if (status != 0) break;
    if (parents[vertex] >= 0) {
      total += keys[vertex];
      ++selected;
      status = emit_event(events, event_capacity, &event_count, MST_EVENT_PRIM_ACCEPT,
                          parents[vertex], vertex, keys[vertex], total, selected,
                          components, 0);
      if (status != 0) break;
    }

    for (int edge_index = heads[vertex]; edge_index != -1; edge_index = adjacency[edge_index].next) {
      int neighbor = adjacency[edge_index].to;
      int weight = adjacency[edge_index].weight;
      status = emit_event(events, event_capacity, &event_count, MST_EVENT_PRIM_EXAMINE,
                          vertex, neighbor, weight, total, selected, keys[neighbor], 0);
      if (status != 0) break;
      if (visited[neighbor]) {
        status = emit_event(events, event_capacity, &event_count, MST_EVENT_PRIM_SKIP,
                            vertex, neighbor, weight, total, selected, 1, 0);
      } else if (weight < keys[neighbor]) {
        keys[neighbor] = weight;
        parents[neighbor] = vertex;
        heap_insert_or_decrease(&heap, neighbor);
        status = emit_event(events, event_capacity, &event_count, MST_EVENT_PRIM_UPDATE,
                            neighbor, vertex, weight, total, selected, keys[neighbor], 0);
      }
      if (status != 0) break;
    }
  }

  if (status == 0 && components > 1) {
    status = emit_event(events, event_capacity, &event_count, MST_EVENT_DISCONNECTED,
                        components, 0, 0, total, selected, 0, 0);
  }
  if (status == 0) {
    status = emit_event(events, event_capacity, &event_count, MST_EVENT_COMPLETE,
                        components, 0, 0, total, selected, components == 1, 0);
  }
  mst_result_total = total;
  mst_result_count = selected;
  mst_result_components = components;
  free(heads); free(keys); free(parents); free(visited);
  free(heap_items); free(heap_positions); free(adjacency);
  if (status != 0) return status;
  return event_count;
}
