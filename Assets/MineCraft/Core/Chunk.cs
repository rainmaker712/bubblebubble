namespace MineCraft.Core
{
    public sealed class Chunk
    {
        public const int Size = 16, Height = 128;
        public readonly int X, Z;
        readonly byte[] blocks = new byte[Size * Height * Size];

        // Highest y that has ever held a non-air block; lets meshing skip the empty sky.
        public int MaxY { get; private set; } = -1;

        public Chunk(int x, int z) { X = x; Z = z; }

        public byte Get(int lx, int ly, int lz) => blocks[(ly * Size + lz) * Size + lx];

        public void Set(int lx, int ly, int lz, byte id)
        {
            blocks[(ly * Size + lz) * Size + lx] = id;
            if (id != Blocks.Air && ly > MaxY) MaxY = ly;
        }
    }
}
