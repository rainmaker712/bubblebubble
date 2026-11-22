using System.Collections.Generic;
using UnityEngine;
using MineCraft.Core;

namespace MineCraft.Rendering
{
    // Streams chunk meshes in around a target, nearest first, and rebuilds chunks the world reports as changed.
    public sealed class ChunkRenderer : MonoBehaviour
    {
        public int radius = 7;
        public int buildsPerFrame = 3;

        VoxelWorld world;
        Material material;
        Transform target;
        readonly Dictionary<long, MeshFilter> built = new Dictionary<long, MeshFilter>();
        readonly HashSet<long> dirty = new HashSet<long>();
        readonly List<long> scratch = new List<long>();
        Vector2Int[] order;

        public void Init(VoxelWorld world, Material material, Transform target)
        {
            this.world = world; this.material = material; this.target = target;
            world.ChunkChanged += (cx, cz) => dirty.Add(VoxelWorld.Key(cx, cz));
            var offsets = new List<Vector2Int>();
            for (int x = -radius; x <= radius; x++)
                for (int z = -radius; z <= radius; z++)
                    if (x * x + z * z <= radius * radius) offsets.Add(new Vector2Int(x, z));
            offsets.Sort((a, b) => a.sqrMagnitude.CompareTo(b.sqrMagnitude));
            order = offsets.ToArray();
        }

        public void BuildAround(Vector3 position, int chunkRadius)
        {
            int pcx = VoxelWorld.ToChunk(Mathf.FloorToInt(position.x)), pcz = VoxelWorld.ToChunk(Mathf.FloorToInt(position.z));
            for (int x = -chunkRadius; x <= chunkRadius; x++)
                for (int z = -chunkRadius; z <= chunkRadius; z++)
                    Build(pcx + x, pcz + z);
        }

        void Update()
        {
            if (world == null) return;
            foreach (long key in dirty)
                if (built.TryGetValue(key, out var mf))
                {
                    var chunk = world.GetChunk((int)(key >> 32), (int)(uint)key);
                    VoxelMesh.Build(world, chunk, mf.sharedMesh);
                }
            dirty.Clear();

            int pcx = VoxelWorld.ToChunk(Mathf.FloorToInt(target.position.x));
            int pcz = VoxelWorld.ToChunk(Mathf.FloorToInt(target.position.z));
            int budget = buildsPerFrame;
            foreach (var o in order)
            {
                if (budget <= 0) break;
                if (built.ContainsKey(VoxelWorld.Key(pcx + o.x, pcz + o.y))) continue;
                Build(pcx + o.x, pcz + o.y);
                budget--;
            }

            scratch.Clear();
            foreach (var pair in built)
            {
                int cx = (int)(pair.Key >> 32), cz = (int)(uint)pair.Key;
                if (Mathf.Abs(cx - pcx) > radius + 2 || Mathf.Abs(cz - pcz) > radius + 2) scratch.Add(pair.Key);
            }
            foreach (long key in scratch)
            {
                Destroy(built[key].sharedMesh);
                Destroy(built[key].gameObject);
                built.Remove(key);
            }
        }

        void Build(int cx, int cz)
        {
            long key = VoxelWorld.Key(cx, cz);
            if (built.ContainsKey(key)) return;
            var go = new GameObject($"Chunk {cx},{cz}");
            go.transform.SetParent(transform, false);
            go.transform.position = new Vector3(cx * Chunk.Size, 0, cz * Chunk.Size);
            var mf = go.AddComponent<MeshFilter>();
            go.AddComponent<MeshRenderer>().sharedMaterial = material;
            mf.sharedMesh = VoxelMesh.Build(world, world.GetChunk(cx, cz));
            built[key] = mf;
        }
    }
}
