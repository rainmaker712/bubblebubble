# BubbleBubble · Unity

낙콩과 무닝의 2인용 거품 액션 게임입니다. **Unity 6.3 LTS / C#**로 실행합니다. 저장소 루트가 Unity 프로젝트이며, 기존 웹 버전은 비교·복구용으로 보존했습니다.

## 게임 실행

```sh
python3 run_game.py
```

macOS 빌드가 있으면 `Builds/macOS/BubbleBubble.app`을 실행하고, 없으면 Unity Editor를 엽니다.

```sh
python3 run_game.py --editor          # Unity Editor 열기
python3 scripts/unity.py doctor       # 설치 위치와 버전 확인
```

Unity에서 `Assets/BubbleBubble/Scenes/Main.unity`를 열고 **Play**를 누르세요. 프로젝트 메뉴 `BubbleBubble > Open Game Scene`으로도 열 수 있습니다.

## 처음 설치하는 컴퓨터

1. [Unity Hub](https://unity.com/download)를 설치하고 본인 계정의 라이선스를 활성화합니다.
2. [Unity 6000.3.26f1](https://unity.com/releases/editor/whats-new/6000.3.26f1)를 설치합니다. Apple Silicon Mac은 ARM64 Editor를 선택합니다.
3. Hub의 **Add project from disk**에서 이 저장소 폴더를 선택합니다.
4. 첫 임포트 후 `Main` 씬에서 Play를 누릅니다. Node.js나 npm은 필요하지 않습니다.

씬·해상도·입력·빌드 설정은 저장소에 포함되어 있습니다. 설정을 다시 적용하려면 Editor를 닫고 `python3 scripts/unity.py setup`을 실행하거나 `BubbleBubble > Configure Project`를 선택합니다. Editor 설치 경로가 다르면 `UNITY_EDITOR` 환경 변수나 `scripts/unity.py --editor /path/to/Unity`를 사용합니다.

## 조작

| 동작 | 1P 낙콩 | 2P 무닝 |
| --- | --- | --- |
| 이동 | A / D | ← / → |
| 점프·구름 비행 | W | ↑ |
| 거품 발사 | F | . |

- 타이틀에서 `1` / `2` 또는 버튼으로 인원을 선택하면 한국어 음성이 나오는 8장 프롤로그가 시작됩니다. `Enter` / `Space` 또는 다음 버튼으로 넘기고, 마지막 장에서 모험을 시작합니다. 이전 장과 다시 듣기도 지원합니다. 음성은 게임에 포함되어 인터넷 없이 재생됩니다.
- 마지막 보스를 이기면 한국어 음성이 있는 4장 엔딩이 나옵니다. 간식을 되찾아 냉장고를 채우고 함께 나눠 먹는 이야기이며, 마지막 장에서 최종 점수 화면으로 돌아갑니다.
- 1~6탄은 도쿄빙수, 케이크, 아이스크림, 마카롱, 수족관, 수박 테마입니다. 배경·발판·간식 그림에 반영했습니다. 7~10탄은 기존 구성을 유지합니다.
- **똥 아이템**을 먹으면 해당 스테이지에서 고래귀신 등장 시 물고기 부하 3마리가 함께 나옵니다. 고래가 이미 있으면 즉시 등장하며, 물고기는 거품으로 포획할 수 있습니다. 반복 획득으로 부하가 늘어나지는 않습니다. 이 효과는 생명을 잃거나 이어하기를 해도 남고, 다음 스테이지나 새 게임에서 해제됩니다.
- `Esc`: 일시정지, `C`: 전원 생명 소진 후 10초 안에 이어하기, `M`: 음악 켜기/끄기.
- 귀신을 거품에 가둔 후 몸으로 터뜨리고 간식을 모으면 다음 스테이지로 갑니다.
- 내려올 때 점프 키를 누른 채 빈 거품에 닿으면 거품을 밟아 점프합니다.
- 1~9탄은 일반 스테이지, 마지막 10탄은 보스전입니다. 입장할 때 번개 왕·불꽃 왕·얼음 왕 중 하나가 무작위로 등장합니다. 불꽃 피해 3, 번개 피해 2, 기본·물 거품 피해 1입니다.
- 물·불·번개·신발·구름·무지개·별똥별 능력은 획득한 스테이지 안에서만 유지되며, 다음 스테이지로 넘어가거나 목숨을 하나 잃으면 해제됩니다. 공격 속성은 마지막 획득 속성으로 바뀝니다.
- 방패 1회, 무지개 충돌 보호 10회는 사용하면 소모됩니다. 무지개 거품은 보호 횟수가 0이어도 해당 스테이지에서 목숨을 잃기 전까지 유지됩니다.
- 별똥별은 발사할 때마다 일반 적 하나를 데려갑니다. 보스·귀신 고래·포획된 적은 대상에서 제외됩니다. 일반 스테이지의 랜덤 아이템에 포함되며, 별똥별을 포함한 특수 아이템 전체가 스테이지당 최대 2개입니다.
- 아이템은 처음부터 놓여 있지 않습니다. 플레이 시작 후 4~8초 사이에 하나, 그 뒤 8~12초 뒤에 하나가 종류와 위치를 무작위로 정해 나타납니다. 안전한 빈 발판 위치가 없으면 잠시 뒤 다시 시도합니다.
- **쓰레기통은 나쁜 아이템**입니다. 먹으면 점수 보상 없이 유령고래가 즉시 등장하며, 보스전에서도 소환됩니다. 시간이 줄어드는 것은 아니지만 위험 음악이 시작됩니다.
- 유령고래는 원작 Skel-Monsta의 흰 몸·붉은 눈·톱니 입을 참고한 2프레임 픽셀 그림으로 변경했습니다.
- EXIT 글자를 모으면 보너스와 스테이지 건너뛰기를 얻습니다. 살아 있는 보스는 건너뛸 수 없습니다.

## 테스트·빌드

같은 프로젝트의 Editor를 닫은 상태에서 실행하세요.

```sh
python3 scripts/unity.py test
python3 scripts/unity.py build --target mac
```

- Edit Mode: 스테이지별 능력 초기화, 랜덤 등장·상한, 쓰레기통·고래, 랜덤 보스·공격, 포획·이어하기 등 규칙 테스트 21개.
- Play Mode: 1인·2인 시작 시 프롤로그 8장과 음성 재생·이전·다시 듣기·게임 진입, 최종 보스 클리어 후 엔딩·점수 유지·재시작, 실제 씬 로드, 한글 폰트·셰이더·62개 스프라이트, 10개 스테이지 렌더러와 입력 연결 테스트.
- 결과와 로그: `TestResults/` (Git 제외).
- macOS 결과: `Builds/macOS/BubbleBubble.app` (Git 제외).
- Windows/Web 빌드 메뉴와 명령도 제공합니다. 해당 플랫폼 모듈을 Hub에서 설치해야 하며, 이번 전환의 실행 검증 대상은 macOS입니다.

## 프로젝트 구성

| 위치 | 역할 |
| --- | --- |
| `Assets/BubbleBubble/Scenes/Main.unity` | 시작 씬 |
| `Assets/BubbleBubble/Runtime/GameWorld.cs` | 고정 시간 간격의 게임 시뮬레이션 |
| `Assets/BubbleBubble/Runtime/GameModel.cs` | 스테이지·캐릭터·아이템 데이터와 규칙 |
| `Assets/BubbleBubble/Runtime/GameApp.cs` | Unity 화면·카메라·키보드·한글 UI |
| `Assets/BubbleBubble/Runtime/MoonlightAudio.cs` | 원작 멜로디 기반 음악 합성·설정 저장 |
| `Assets/BubbleBubble/Resources/Stages/` | **Unity에서 사용하는** 스테이지 JSON 10개 |
| `Assets/BubbleBubble/Resources/Art/` | 기존·추가 픽셀 그림 PNG 62개 |
| `Assets/BubbleBubble/Resources/Rainbow.shader` | 무지개 거품·캐릭터 셰이더 |
| `Assets/BubbleBubble/Editor/ProjectSetup.cs` | 임포트 규칙·씬 구성·빌드 메뉴 |
| `Assets/BubbleBubble/Tests/` | Unity Test Framework 테스트 |

스테이지를 수정할 때는 `Resources/Stages` 파일을 편집하세요. `docs/samples`는 이전 웹 버전 데이터이며 자동 동기화하지 않습니다. 자세한 전환 범위와 설계는 [Unity 전환 문서](docs/UNITY_MIGRATION.md)를 참고하세요.

## 기존 웹 버전

`src/`, `index.html`, npm 설정은 기존 작업을 보존하기 위해 남겨두었습니다. Unity 앱에서는 읽거나 실행하지 않습니다.

```sh
npm install
python3 run_game.py --web
```

이전 설명은 [웹 버전 기록](docs/archive/WEB_README.md)에 있습니다. `npm run dev`, `npm test`, `npm run build`는 웹 버전 전용입니다.

## 리소스

캐릭터와 픽셀 그림은 기존 프로젝트의 `characters.ts`·`arcadeArt.ts`에서 내보냈습니다. 재생성 도구는 `scripts/export_unity_art.mjs`이며, Unity 실행에는 필요하지 않습니다. 한글 폰트는 [Google Fonts Noto Sans KR](https://github.com/google/fonts/tree/main/ofl/notosanskr)의 500 굵기 정적 인스턴스입니다. 배포 라이선스는 `Assets/BubbleBubble/Resources/Fonts/OFL.txt`에 포함되어 있습니다.

리뷰 4~8번 반영 내역과 그림 참고 자료는 [10/22 추가 구현 기록](docs/updates/review-10-22-implementation.md)에 정리했습니다.

10/24 테마·아이템·프롤로그 반영 내용은 [업데이트 기록](docs/updates/review-10-24-implementation.md)에 있습니다.
