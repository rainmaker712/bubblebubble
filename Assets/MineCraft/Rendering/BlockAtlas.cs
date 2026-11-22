using UnityEngine;

namespace MineCraft.Rendering
{
    // 16x16 pixel-art tiles painted in code so the game ships without texture assets.
    public static class BlockAtlas
    {
        public const int TilePixels = 16, Columns = 4;
        const int Pixels = TilePixels * Columns;

        public static Rect TileRect(int tile)
        {
            const float size = 1f / Columns, inset = .02f / Columns;
            float u = tile % Columns * size, v = tile / Columns * size;
            return new Rect(u + inset, v + inset, size - inset * 2, size - inset * 2);
        }

        public static Texture2D Create()
        {
            var tex = new Texture2D(Pixels, Pixels, TextureFormat.RGBA32, false)
            {
                name = "MineCraft Atlas", filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp
            };
            var px = new Color32[Pixels * Pixels];
            var rng = new System.Random(1234);
            for (int tile = 0; tile < 13; tile++)
                for (int y = 0; y < TilePixels; y++)
                    for (int x = 0; x < TilePixels; x++)
                    {
                        float n = (float)rng.NextDouble();
                        int ox = tile % Columns * TilePixels, oy = tile / Columns * TilePixels;
                        px[(oy + y) * Pixels + ox + x] = Paint(tile, x, y, n);
                    }
            tex.SetPixels32(px);
            tex.Apply(false, false);
            return tex;
        }

        static Color32 Jitter(Color c, float n, float amount) => (Color32)(c * (1 - amount + n * amount * 2));

        static Color32 Paint(int tile, int x, int y, float n)
        {
            var dirt = new Color(.53f, .38f, .25f);
            var grass = new Color(.38f, .62f, .22f);
            switch (tile)
            {
                case 0: return Jitter(new Color(.5f, .5f, .5f), n, .12f);
                case 1: return Jitter(grass, n, .15f);
                case 2:
                    int edge = 12 - (int)(n * 3) + ((x * 7) % 3 == 0 ? 1 : 0);
                    return y >= edge ? Jitter(grass, n, .12f) : Jitter(dirt, n, .15f);
                case 3: return Jitter(dirt, n, .15f);
                case 4:
                    bool mortar = (x + (y / 4 % 2) * 3) % 6 == 0 || y % 4 == 0;
                    return Jitter(mortar ? new Color(.35f, .35f, .35f) : new Color(.55f, .55f, .55f), n, .15f);
                case 5:
                    bool seam = y % 4 == 0 || (x == (y / 4 % 2 == 0 ? 4 : 11));
                    return Jitter(seam ? new Color(.5f, .38f, .22f) : new Color(.74f, .58f, .35f), n, .06f);
                case 6: return Jitter(x % 4 == 0 ? new Color(.3f, .22f, .12f) : new Color(.42f, .32f, .18f), n, .1f);
                case 7:
                    float r = Mathf.Max(Mathf.Abs(x - 7.5f), Mathf.Abs(y - 7.5f));
                    return r > 6.5f ? Jitter(new Color(.42f, .32f, .18f), n, .1f)
                        : Jitter((int)r % 2 == 0 ? new Color(.7f, .56f, .34f) : new Color(.6f, .47f, .28f), n, .05f);
                case 8: return Jitter(n > .6f ? new Color(.12f, .12f, .12f) : new Color(.32f, .32f, .32f), n, .2f);
                case 9:
                    if (n < .18f) return new Color32(0, 0, 0, 0);
                    return Jitter(new Color(.2f, .48f, .16f), n, .25f);
                case 10: return Jitter(new Color(.86f, .81f, .6f), n, .06f);
                case 11:
                    bool frame = x == 0 || y == 0 || x == 15 || y == 15 || (x == y && x > 3 && x < 8) || (x == y + 1 && x > 4 && x < 9);
                    return frame ? new Color32(220, 240, 250, 255) : new Color32(0, 0, 0, 0);
                case 12:
                    bool line = y % 4 == 0 || (x + (y / 4 % 2) * 4) % 8 == 0;
                    return Jitter(line ? new Color(.72f, .7f, .66f) : new Color(.6f, .25f, .2f), n, .1f);
            }
            return new Color32(255, 0, 255, 255);
        }
    }
}
