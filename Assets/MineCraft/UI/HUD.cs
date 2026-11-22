using UnityEngine;
using MineCraft.Core;
using MineCraft.Entities;
using MineCraft.Rendering;

namespace MineCraft.UI
{
    public sealed class HUD : MonoBehaviour
    {
        const float RefHeight = 720f;
        PlayerController player;
        Texture2D atlas;
        GUIStyle label, center, title;
        float fps = 60;

        public void Init(PlayerController player, Texture2D atlas) { this.player = player; this.atlas = atlas; }

        void Update() => fps = Mathf.Lerp(fps, 1f / Mathf.Max(Time.unscaledDeltaTime, 1e-4f), .05f);

        void OnGUI()
        {
            if (player == null) return;
            if (label == null)
            {
                label = new GUIStyle(GUI.skin.label) { fontSize = 15, normal = { textColor = Color.white } };
                center = new GUIStyle(label) { alignment = TextAnchor.MiddleCenter, fontSize = 17 };
                title = new GUIStyle(center) { fontSize = 42, fontStyle = FontStyle.Bold };
            }
            float scale = Screen.height / RefHeight;
            GUI.matrix = Matrix4x4.Scale(new Vector3(scale, scale, 1));
            float w = Screen.width / scale, h = RefHeight;

            if (player.HurtFlash > 0) Fill(new Rect(0, 0, w, h), new Color(.8f, 0, 0, player.HurtFlash * .35f));

            Fill(new Rect(w / 2 - 10, h / 2 - 1, 20, 2), Color.white);
            Fill(new Rect(w / 2 - 1, h / 2 - 10, 2, 20), Color.white);

            DrawHotbar(w, h);
            DrawHearts(w, h);

            Shadowed(new Rect(10, 8, 600, 22), $"마인크래프트  |  XYZ {player.Coordinates}  |  {fps:0} FPS{(player.Flying ? "  |  비행 중" : "")}", label);
            if (player.Message != null && Time.time - player.MessageTime < 2.5f)
                Shadowed(new Rect(0, h - 170, w, 26), player.Message, center);

            if (!player.CursorLocked)
            {
                Fill(new Rect(0, 0, w, h), new Color(0, 0, 0, .55f));
                Shadowed(new Rect(0, h / 2 - 170, w, 60), "MINECRAFT", title);
                Shadowed(new Rect(0, h / 2 - 105, w, 30), "화면을 클릭하면 시작합니다", center);
                string help = "WASD 이동   마우스 시점   Space 점프   Shift 달리기\n" +
                              "왼쪽 클릭 블록 부수기 / 공격   오른쪽 클릭 블록 놓기\n" +
                              "1-9 · 휠 블록 선택   F 또는 Space 두 번 비행 (Space 위 / Shift 아래)\n" +
                              "Esc 마우스 풀기   ⌘Q 종료";
                Shadowed(new Rect(0, h / 2 - 50, w, 110), help, center);
            }
        }

        void DrawHotbar(float w, float h)
        {
            const float slot = 50, pad = 4;
            int count = PlayerController.Hotbar.Length;
            float x0 = w / 2 - count * slot / 2, y = h - slot - 12;
            Fill(new Rect(x0 - 3, y - 3, count * slot + 6, slot + 6), new Color(0, 0, 0, .45f));
            for (int i = 0; i < count; i++)
            {
                var r = new Rect(x0 + i * slot, y, slot, slot);
                if (i == player.Selected) Fill(r, Color.white);
                Fill(new Rect(r.x + 2, r.y + 2, slot - 4, slot - 4), new Color(.25f, .25f, .25f, .85f));
                byte id = PlayerController.Hotbar[i];
                GUI.DrawTextureWithTexCoords(new Rect(r.x + pad + 4, r.y + pad + 4, slot - 2 * pad - 8, slot - 2 * pad - 8),
                    atlas, BlockAtlas.TileRect(Blocks.Tile(id, Face.North)));
                Shadowed(new Rect(r.x + 4, r.y + 1, 20, 18), (i + 1).ToString(), label);
            }
            Shadowed(new Rect(0, y - 52, w, 24), Blocks.Name(PlayerController.Hotbar[player.Selected]), center);
        }

        void DrawHearts(float w, float h)
        {
            const float size = 16, gap = 3;
            float x0 = w / 2 - PlayerController.Hotbar.Length * 25, y = h - 50 - 12 - size - 8;
            for (int i = 0; i < 10; i++)
            {
                var r = new Rect(x0 + i * (size + gap), y, size, size);
                Fill(r, Color.black);
                float hp = player.Health - i * 2;
                var inner = new Rect(r.x + 2, r.y + 2, size - 4, size - 4);
                Fill(inner, new Color(.3f, .1f, .1f));
                if (hp >= 2) Fill(inner, new Color(.9f, .1f, .12f));
                else if (hp >= 1) Fill(new Rect(inner.x, inner.y, inner.width / 2, inner.height), new Color(.9f, .1f, .12f));
            }
        }

        static void Fill(Rect r, Color c)
        {
            var old = GUI.color;
            GUI.color = c;
            GUI.DrawTexture(r, Texture2D.whiteTexture);
            GUI.color = old;
        }

        static void Shadowed(Rect r, string text, GUIStyle style)
        {
            var old = style.normal.textColor;
            style.normal.textColor = new Color(0, 0, 0, .8f);
            GUI.Label(new Rect(r.x + 2, r.y + 2, r.width, r.height), text, style);
            style.normal.textColor = old;
            GUI.Label(r, text, style);
        }
    }
}
