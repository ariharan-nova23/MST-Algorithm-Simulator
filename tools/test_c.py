import os
import shutil
import subprocess
import sys
import tempfile


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = [
    os.path.join(ROOT, "c", "main.c"),
    os.path.join(ROOT, "c", "kruskal.c"),
    os.path.join(ROOT, "c", "prim.c"),
    os.path.join(ROOT, "c", "union_find.c"),
    os.path.join(ROOT, "c", "test_algorithms.c"),
]


def main():
    compiler = shutil.which("gcc") or shutil.which("clang") or shutil.which("cc")
    use_emscripten = compiler is None
    compiler = compiler or shutil.which("emcc")
    node = shutil.which("node") if use_emscripten else None
    if not compiler or (use_emscripten and not node):
        print(
            "Install gcc/clang/cc, or activate Emscripten and install Node.js, "
            "to run `npm run test:c`.",
            file=sys.stderr,
        )
        return 1

    with tempfile.TemporaryDirectory(prefix="mst-c-test-") as directory:
        executable = os.path.join(
            directory,
            "mst-test.js" if use_emscripten else ("mst-test.exe" if os.name == "nt" else "mst-test"),
        )
        command = [
            compiler, "-std=c11", "-O2", "-Wall", "-Wextra",
            "-I", os.path.join(ROOT, "c"), *SOURCES,
        ]
        if use_emscripten:
            command.extend(["-s", "ENVIRONMENT=node", "-s", "EXIT_RUNTIME=1"])
        command.extend(["-o", executable])
        built = subprocess.run(command, cwd=ROOT, check=False)
        if built.returncode:
            return built.returncode
        tested = subprocess.run([node, executable] if use_emscripten else [executable], cwd=ROOT, check=False)
        if tested.returncode == 0:
            print("C algorithm tests passed.")
        return tested.returncode


if __name__ == "__main__":
    raise SystemExit(main())
