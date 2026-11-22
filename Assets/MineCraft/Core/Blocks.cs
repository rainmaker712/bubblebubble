namespace MineCraft.Core
{
    public enum Face { Up, Down, North, South, East, West }

    public static class Blocks
    {
        public const byte Air = 0, Stone = 1, Grass = 2, Dirt = 3, Cobblestone = 4, Planks = 5, Log = 6,
            Bedrock = 7, Leaves = 8, Sand = 9, Glass = 10, Brick = 11;
        public const int Count = 12;

        // Atlas tile per block: top, side, bottom (see BlockAtlas for the tile art).
        static readonly int[,] tiles =
        {
            { 0, 0, 0 },    // air
            { 0, 0, 0 },    // stone
            { 1, 2, 3 },    // grass
            { 3, 3, 3 },    // dirt
            { 4, 4, 4 },    // cobblestone
            { 5, 5, 5 },    // planks
            { 7, 6, 7 },    // log
            { 8, 8, 8 },    // bedrock
            { 9, 9, 9 },    // leaves
            { 10, 10, 10 }, // sand
            { 11, 11, 11 }, // glass
            { 12, 12, 12 }, // brick
        };

        static readonly string[] names = { "공기", "돌", "잔디", "흙", "조약돌", "나무 판자", "원목", "기반암", "나뭇잎", "모래", "유리", "벽돌" };

        public static string Name(byte id) => id < Count ? names[id] : "?";
        public static bool IsSolid(byte id) => id != Air;
        public static bool IsOpaque(byte id) => id != Air && id != Leaves && id != Glass;
        public static bool IsBreakable(byte id) => id != Air && id != Bedrock;

        public static int Tile(byte id, Face face)
        {
            if (id >= Count) id = Stone;
            return tiles[id, face == Face.Up ? 0 : face == Face.Down ? 2 : 1];
        }
    }
}
