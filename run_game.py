#!/usr/bin/env python3
"""BubbleBubble Phaser 개발 서버 실행기."""

from __future__ import annotations

import subprocess
import threading
import webbrowser
from pathlib import Path


HOST = "127.0.0.1"
PORT = 4173
ROOT = Path(__file__).resolve().parent


def main() -> None:
    url = f"http://{HOST}:{PORT}"
    print(f"BubbleBubble 실행 중: {url}")
    print("종료하려면 Ctrl+C를 누르세요.")
    process = subprocess.Popen(
        ["npm", "run", "dev", "--", "--port", str(PORT)],
        cwd=ROOT,
    )
    threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    try:
        process.wait()
    except KeyboardInterrupt:
        process.terminate()
        process.wait(timeout=5)
        print("\n게임 서버를 종료합니다.")


if __name__ == "__main__":
    main()
