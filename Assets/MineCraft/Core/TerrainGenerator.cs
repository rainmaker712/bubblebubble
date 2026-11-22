using UnityEngine;

namespace MineCraft.Core
{
    public sealed class TerrainGenerator
    {
        public const int SandLevel = 29;
        readonly int seed;
        readonly float ox, oz;

        public TerrainGenerator(int seed)
        {
            this.seed = seed;
            var random = new System.Random(seed);
            ox = random.Next(-5000, 5000) + .5f;
            oz = random.Next(-5000, 5000) + .5f;
        }

        public int HeightAt(int x, int z)
        {
            float px = x + ox, pz = z + oz;
            float hills = Mathf.PerlinNoise(px * .012f, pz * .012f) * .65f
                + Mathf.PerlinNoise(px * .045f, pz * .045f) * .25f
                + Mathf.PerlinNoise(px * .11f, pz * .11f) * .1f;
            float mountains = Mathf.Max(0, Mathf.PerlinNoise(px * .006f + 31.7f, pz * .006f - 12.3f) - .55f);
            return Mathf.Clamp(24 + (int)(hills * 22 + mountains * 90), 8, Chunk.Height - 12);
        }

        public void Generate(Chunk chunk)
        {
            for (int lx = 0; lx < Chunk.Size; lx++)
                for (int lz = 0; lz < Chunk.Size; lz++)
                {
                    int x = chunk.X * Chunk.Size + lx, z = chunk.Z * Chunk.Size + lz;
                    int h = HeightAt(x, z);
                    bool beach = h <= SandLevel;
                    chunk.Set(lx, 0, lz, Blocks.Bedrock);
                    for (int y = 1; y <= h; y++)
                    {
                        byte id = y < h - 3 ? Blocks.Stone : beach ? Blocks.Sand : y < h ? Blocks.Dirt : Blocks.Grass;
                        chunk.Set(lx, y, lz, id);
                    }
                    // Trees stay inside their chunk so generation never writes into a neighbour.
                    if (!beach && lx >= 2 && lx <= 13 && lz >= 2 && lz <= 13 && Hash(x, z) % 1000 < 12)
                        PlantTree(chunk, lx, h + 1, lz, 4 + (int)(Hash(z, x) % 2));
                }
        }

        static void PlantTree(Chunk chunk, int lx, int y, int lz, int trunk)
        {
            if (y + trunk + 2 >= Chunk.Height) return;
            for (int dy = trunk - 2; dy <= trunk + 1; dy++)
            {
                int r = dy >= trunk ? 1 : 2;
                for (int dx = -r; dx <= r; dx++)
                    for (int dz = -r; dz <= r; dz++)
                    {
                        if (r == 2 && Mathf.Abs(dx) == 2 && Mathf.Abs(dz) == 2) continue;
                        if (chunk.Get(lx + dx, y + dy, lz + dz) == Blocks.Air) chunk.Set(lx + dx, y + dy, lz + dz, Blocks.Leaves);
                    }
            }
            for (int dy = 0; dy < trunk; dy++) chunk.Set(lx, y + dy, lz, Blocks.Log);
        }

        uint Hash(int x, int z)
        {
            unchecked
            {
                uint h = (uint)(x * 374761393 + z * 668265263 + seed * 982451653);
                h = (h ^ (h >> 13)) * 1274126177;
                return h ^ (h >> 16);
            }
        }
    }
}
