#!/usr/bin/env python3
"""Regenerate bundled Korean narration with macOS's installed Yuna voice.

Only asset generation needs macOS TTS. The game plays the bundled WAV files
through Unity AudioSource, offline on every supported platform.
"""
from pathlib import Path
import subprocess

import json

ROOT = Path(__file__).resolve().parents[1]

if __name__ == "__main__":
    folder = ROOT / "Assets/BubbleBubble/Resources/Audio"
    folder.mkdir(parents=True, exist_ok=True)
    # The same JSON supplies the game's subtitles and narration.
    for name, prefix in (("prologue", "story"), ("ending", "ending")):
        pages = json.loads((ROOT / f"Assets/BubbleBubble/Resources/Story/{name}.json").read_text())["pages"]
        for page, chapter in enumerate(pages, 1):
            output = folder / f"{prefix}-{page:02}.wav"
            subprocess.run([
                "say", "-v", "Yuna", "-r", "155", "-o", str(output),
                "--file-format=WAVE", "--data-format=LEI16@22050", " ".join(chapter["lines"]),
            ], check=True)
            print(output.relative_to(ROOT))
