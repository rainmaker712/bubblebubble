using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using MineCraft.Core;

namespace MineCraft.Rendering
{
    public static class VoxelMesh
    {
        // Per face: neighbour offset, four corners wound clockwise when seen from outside.
        static readonly Vector3Int[] offsets =
        {
            Vector3Int.up, Vector3Int.down, new Vector3Int(0, 0, 1), new Vector3Int(0, 0, -1), Vector3Int.right, Vector3Int.left
        };
        static readonly Vector3[][] corners =
        {
            new[] { new Vector3(0, 1, 0), new Vector3(0, 1, 1), new Vector3(1, 1, 1), new Vector3(1, 1, 0) },
            new[] { new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(1, 0, 1), new Vector3(0, 0, 1) },
            new[] { new Vector3(1, 0, 1), new Vector3(1, 1, 1), new Vector3(0, 1, 1), new Vector3(0, 0, 1) },
            new[] { new Vector3(0, 0, 0), new Vector3(0, 1, 0), new Vector3(1, 1, 0), new Vector3(1, 0, 0) },
            new[] { new Vector3(1, 0, 0), new Vector3(1, 1, 0), new Vector3(1, 1, 1), new Vector3(1, 0, 1) },
            new[] { new Vector3(0, 0, 1), new Vector3(0, 1, 1), new Vector3(0, 1, 0), new Vector3(0, 0, 0) },
        };
        // Cheap directional lighting baked into vertex colour.
        static readonly float[] shade = { 1f, .55f, .8f, .8f, .68f, .68f };

        static readonly List<Vector3> verts = new List<Vector3>();
        static readonly List<Vector2> uvs = new List<Vector2>();
        static readonly List<Color32> colors = new List<Color32>();
        static readonly List<int> tris = new List<int>();

        public static Mesh Build(VoxelWorld world, Chunk chunk, Mesh mesh = null)
        {
            verts.Clear(); uvs.Clear(); colors.Clear(); tris.Clear();
            int wx = chunk.X * Chunk.Size, wz = chunk.Z * Chunk.Size;
            for (int y = 0; y <= chunk.MaxY; y++)
                for (int z = 0; z < Chunk.Size; z++)
                    for (int x = 0; x < Chunk.Size; x++)
                    {
                        byte id = chunk.Get(x, y, z);
                        if (id == Blocks.Air) continue;
                        for (int f = 0; f < 6; f++)
                        {
                            var o = offsets[f];
                            int nx = x + o.x, ny = y + o.y, nz = z + o.z;
                            byte n = nx >= 0 && nx < Chunk.Size && nz >= 0 && nz < Chunk.Size && ny >= 0 && ny < Chunk.Height
                                ? chunk.Get(nx, ny, nz)
                                : world.GetBlock(wx + nx, ny, wz + nz);
                            if (Blocks.IsOpaque(n) || (n == id && !Blocks.IsOpaque(id))) continue;
                            AddFace(new Vector3(x, y, z), f, Blocks.Tile(id, (Face)f));
                        }
                    }
            if (mesh == null) mesh = new Mesh { name = $"Chunk {chunk.X},{chunk.Z}" };
            mesh.Clear();
            mesh.indexFormat = IndexFormat.UInt32;
            mesh.SetVertices(verts);
            mesh.SetUVs(0, uvs);
            mesh.SetColors(colors);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateBounds();
            return mesh;
        }

        static void AddFace(Vector3 pos, int face, int tile)
        {
            int start = verts.Count;
            Rect r = BlockAtlas.TileRect(tile);
            byte s = (byte)(shade[face] * 255);
            var c = new Color32(s, s, s, 255);
            var cs = corners[face];
            for (int i = 0; i < 4; i++) { verts.Add(pos + cs[i]); colors.Add(c); }
            uvs.Add(new Vector2(r.xMin, r.yMin)); uvs.Add(new Vector2(r.xMin, r.yMax));
            uvs.Add(new Vector2(r.xMax, r.yMax)); uvs.Add(new Vector2(r.xMax, r.yMin));
            tris.Add(start); tris.Add(start + 1); tris.Add(start + 2);
            tris.Add(start); tris.Add(start + 2); tris.Add(start + 3);
        }
    }
}
