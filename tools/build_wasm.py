import json
import os
import shutil
import subprocess
import sys


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "wasm", "mst.js")
EXPORTS = [
    "_malloc", "_free", "_run_kruskal", "_run_prim",
    "_benchmark_kruskal", "_benchmark_prim", "_benchmark_uf",
    "_get_result_total", "_get_result_count", "_get_result_components",
    "_get_uf_find_calls", "_get_uf_union_calls", "_get_uf_hops",
    "_get_uf_max_depth",
]


def main():
    compiler = shutil.which("emcc")
    if not compiler:
        print(
            "Emscripten was not found on PATH. Activate the Emscripten SDK "
            "environment, then run `npm run build:wasm` again.",
            file=sys.stderr,
        )
        return 1

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    command = [
        compiler,
        "c/main.c",
        "c/kruskal.c",
        "c/prim.c",
        "c/union_find.c",
        "-O2",
        "-Wall",
        "-Wextra",
        "-std=c11",
        "-s",
        "WASM=1",
        "-s",
        "MODULARIZE=1",
        "-s",
        "EXPORT_NAME=createMstModule",
        "-s",
        "ALLOW_MEMORY_GROWTH=1",
        "-s",
        "ENVIRONMENT=web",
        "-s",
        f"EXPORTED_FUNCTIONS={json.dumps(EXPORTS)}",
        "-s",
        'EXPORTED_RUNTIME_METHODS=["HEAP32"]',
        "-o",
        OUTPUT,
    ]
    return subprocess.run(command, cwd=ROOT, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
