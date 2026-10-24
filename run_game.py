#!/usr/bin/env python3
"""Launch the native Unity game, or use --editor / --web explicitly."""
from pathlib import Path
import argparse
import platform
import subprocess
import sys

ROOT = Path(__file__).resolve().parent

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--editor', action='store_true')
    group.add_argument('--web', action='store_true', help='기존 Phaser 버전 실행')
    args = parser.parse_args()
    if args.web:
        subprocess.run([sys.executable, str(ROOT / 'scripts/run_web_game.py')], cwd=ROOT, check=True)
        return
    mac = ROOT / 'Builds/macOS/BubbleBubble.app'
    windows = ROOT / 'Builds/Windows/BubbleBubble.exe'
    if not args.editor and platform.system() == 'Darwin' and mac.exists():
        subprocess.run(['open', str(mac)], check=True)
    elif not args.editor and platform.system() == 'Windows' and windows.exists():
        subprocess.Popen([str(windows)], cwd=ROOT)
    else:
        subprocess.run([sys.executable, str(ROOT / 'scripts/unity.py'), 'open'], cwd=ROOT, check=True)

if __name__ == '__main__':
    main()
