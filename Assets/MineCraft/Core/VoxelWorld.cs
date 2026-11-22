using System;
using System.Collections.Generic;
using UnityEngine;

namespace MineCraft.Core
{
    // Infinite world of chunks generated on first access. Chunk data is kept in memory so edits persist.
    public sealed class VoxelWorld
    {
        readonly Dictionary<long, Chunk> chunks = new Dictionary<long, Chunk>();
        readonly Action<Chunk> generator;

        public event Action<int, int> ChunkChanged;

        public VoxelWorld(int seed) : this(new TerrainGenerator(seed).Generate) { }
        public VoxelWorld(Action<Chunk> generator) { this.generator = generator; }

        public static long Key(int cx, int cz) => ((long)cx << 32) ^ (uint)cz;
        public static int ToChunk(int v) => v >= 0 ? v / Chunk.Size : (v - Chunk.Size + 1) / Chunk.Size;

        public Chunk GetChunk(int cx, int cz)
        {
            long key = Key(cx, cz);
            if (chunks.TryGetValue(key, out var chunk)) return chunk;
            chunk = new Chunk(cx, cz);
            generator(chunk);
            chunks[key] = chunk;
            return chunk;
        }

        public byte GetBlock(int x, int y, int z)
        {
            if (y < 0) return Blocks.Bedrock;
            if (y >= Chunk.Height) return Blocks.Air;
            int cx = ToChunk(x), cz = ToChunk(z);
            return GetChunk(cx, cz).Get(x - cx * Chunk.Size, y, z - cz * Chunk.Size);
        }

        public bool IsSolid(int x, int y, int z) => Blocks.IsSolid(GetBlock(x, y, z));

        public bool SetBlock(int x, int y, int z, byte id)
        {
            if (y < 0 || y >= Chunk.Height) return false;
            int cx = ToChunk(x), cz = ToChunk(z);
            int lx = x - cx * Chunk.Size, lz = z - cz * Chunk.Size;
            GetChunk(cx, cz).Set(lx, y, lz, id);
            ChunkChanged?.Invoke(cx, cz);
            if (lx == 0) ChunkChanged?.Invoke(cx - 1, cz);
            if (lx == Chunk.Size - 1) ChunkChanged?.Invoke(cx + 1, cz);
            if (lz == 0) ChunkChanged?.Invoke(cx, cz - 1);
            if (lz == Chunk.Size - 1) ChunkChanged?.Invoke(cx, cz + 1);
            return true;
        }

        public int SurfaceY(int x, int z)
        {
            for (int y = Chunk.Height - 1; y > 0; y--)
                if (IsSolid(x, y, z)) return y;
            return 0;
        }

        // Voxel traversal (Amanatides & Woo). normal is the face of the hit block the ray entered through.
        public bool Raycast(Vector3 origin, Vector3 direction, float maxDistance, out Vector3Int hit, out Vector3Int normal)
        {
            hit = normal = Vector3Int.zero;
            if (direction.sqrMagnitude < 1e-8f) return false;
            direction.Normalize();
            int x = Mathf.FloorToInt(origin.x), y = Mathf.FloorToInt(origin.y), z = Mathf.FloorToInt(origin.z);
            int sx = Math.Sign(direction.x), sy = Math.Sign(direction.y), sz = Math.Sign(direction.z);
            float dx = sx != 0 ? Mathf.Abs(1f / direction.x) : float.PositiveInfinity;
            float dy = sy != 0 ? Mathf.Abs(1f / direction.y) : float.PositiveInfinity;
            float dz = sz != 0 ? Mathf.Abs(1f / direction.z) : float.PositiveInfinity;
            float tx = sx > 0 ? (x + 1 - origin.x) * dx : sx < 0 ? (origin.x - x) * dx : float.PositiveInfinity;
            float ty = sy > 0 ? (y + 1 - origin.y) * dy : sy < 0 ? (origin.y - y) * dy : float.PositiveInfinity;
            float tz = sz > 0 ? (z + 1 - origin.z) * dz : sz < 0 ? (origin.z - z) * dz : float.PositiveInfinity;
            var n = Vector3Int.zero;
            float t = 0;
            while (t <= maxDistance)
            {
                if (IsSolid(x, y, z)) { hit = new Vector3Int(x, y, z); normal = n; return true; }
                if (tx < ty && tx < tz) { x += sx; t = tx; tx += dx; n = new Vector3Int(-sx, 0, 0); }
                else if (ty < tz) { y += sy; t = ty; ty += dy; n = new Vector3Int(0, -sy, 0); }
                else { z += sz; t = tz; tz += dz; n = new Vector3Int(0, 0, -sz); }
            }
            return false;
        }
    }
}
