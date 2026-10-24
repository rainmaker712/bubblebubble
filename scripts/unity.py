#!/usr/bin/env python3
"""Open, configure, test, or build the pinned Unity project without npm."""
from __future__ import annotations
import argparse
import os
from pathlib import Path
import platform
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / 'ProjectSettings/ProjectVersion.txt').read_text().splitlines()[0].split(': ', 1)[1]


def editor_path(override: str | None = None) -> Path:
    custom = override or os.environ.get('UNITY_EDITOR')
    if custom:
        path = Path(custom).expanduser()
        if path.suffix == '.app':
            path = path / 'Contents/MacOS/Unity'
        if path.is_file():
            return path
        raise SystemExit(f'Unity 실행 파일이 없습니다: {path}')
    candidates = [
        Path(f'/Applications/Unity/Hub/Editor/{VERSION}/Unity.app/Contents/MacOS/Unity'),
        Path.home() / f'Applications/Unity/Hub/Editor/{VERSION}/Unity.app/Contents/MacOS/Unity',
        Path(f'C:/Program Files/Unity/Hub/Editor/{VERSION}/Editor/Unity.exe'),
        Path.home() / f'Unity/Hub/Editor/{VERSION}/Editor/Unity',
    ]
    for path in candidates:
        if path.is_file():
            return path
    raise SystemExit(f'Unity {VERSION}를 찾지 못했습니다. Unity Hub에서 설치하거나 UNITY_EDITOR를 지정하세요.\nhttps://unity.com/releases/editor/whats-new/{VERSION}')


def run(editor: Path, args: list[str], log: str, graphics: bool = False) -> None:
    out = ROOT / 'TestResults'
    out.mkdir(exist_ok=True)
    cmd = [str(editor), '-batchmode', '-projectPath', str(ROOT), '-logFile', str(out / log)]
    if not graphics:
        cmd.append('-nographics')
    print('Unity 작업 중. 로그:', out / log, flush=True)
    result = subprocess.run(cmd + args, cwd=ROOT)
    if result.returncode:
        raise SystemExit(f'Unity 작업 실패 ({result.returncode}). 로그를 확인하세요: {out / log}')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['doctor', 'setup', 'open', 'test', 'build'], nargs='?', default='open')
    parser.add_argument('--editor')
    parser.add_argument('--target', choices=['mac', 'windows', 'web'], default='mac' if platform.system() == 'Darwin' else 'windows')
    args = parser.parse_args()
    editor = editor_path(args.editor)
    if args.command == 'doctor':
        print(f'Project: {ROOT}\nPinned editor: {VERSION}\nExecutable: {editor}\nScene: Assets/BubbleBubble/Scenes/Main.unity')
    elif args.command == 'open':
        subprocess.Popen([str(editor), '-projectPath', str(ROOT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print('Unity Editor를 열었습니다. Main 씬에서 Play를 누르세요.')
    elif args.command == 'setup':
        run(editor, ['-executeMethod', 'BubbleBubble.Editor.ProjectSetup.Configure', '-quit'], 'setup.log')
    elif args.command == 'build':
        method = {'mac': 'BuildMac', 'windows': 'BuildWindows', 'web': 'BuildWeb'}[args.target]
        run(editor, ['-executeMethod', f'BubbleBubble.Editor.ProjectSetup.{method}', '-quit'], f'build-{args.target}.log')
    else:
        for mode in ['EditMode', 'PlayMode']:
            path = ROOT / 'TestResults' / f'{mode.lower()}.xml'
            # Remove a previous report so a failed run cannot be mistaken for an earlier pass.
            path.unlink(missing_ok=True)
            run(editor, ['-runTests', '-testPlatform', mode, '-testResults', str(path)], mode.lower()+'.log', graphics=mode == 'PlayMode')
            if not path.exists():
                raise SystemExit(f'{mode}: 테스트 보고서가 생성되지 않았습니다.')
            report = ET.parse(path).getroot()
            if report.get('result') != 'Passed' or int(report.get('passed', '0')) == 0:
                raise SystemExit(f'{mode}: 테스트 실패. {path}')
            print(f"{mode}: {report.get('passed')} passed")


if __name__ == '__main__':
    main()
