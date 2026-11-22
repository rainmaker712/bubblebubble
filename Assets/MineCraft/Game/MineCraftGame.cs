using UnityEngine;
using MineCraft.Core;
using MineCraft.Entities;
using MineCraft.Rendering;
using MineCraft.UI;

namespace MineCraft
{
    // Scene entry point: builds the world, camera, player, HUD and mob spawner in code.
    public sealed class MineCraftGame : MonoBehaviour
    {
        public int seed;
        public int viewChunks = 7;
        public int pigs = 6, zombies = 3;

        static readonly Color Sky = new Color(.55f, .74f, 1f);
        VoxelWorld world;
        PlayerController player;
        Material entityMaterial;
        float spawnTimer;

        void Start()
        {
            QualitySettings.vSyncCount = 1;
            if (seed == 0) seed = System.Environment.TickCount;
            world = new VoxelWorld(seed);

            var shader = Resources.Load<Shader>("MineCraftVoxel");
            var atlas = BlockAtlas.Create();
            var blockMaterial = new Material(shader) { name = "Blocks", mainTexture = atlas };
            entityMaterial = new Material(shader) { name = "Entities", mainTexture = Texture2D.whiteTexture };

            float far = viewChunks * Chunk.Size;
            Shader.SetGlobalColor("_MCFogColor", Sky);
            Shader.SetGlobalFloat("_MCFogStart", far * .55f);
            Shader.SetGlobalFloat("_MCFogEnd", far * .95f);

            var camGo = new GameObject("Main Camera") { tag = "MainCamera" };
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Sky;
            cam.fieldOfView = 75;
            cam.nearClipPlane = .05f;
            cam.farClipPlane = far + Chunk.Size;

            var spawn = FindSpawn();
            player = new GameObject("Player").AddComponent<PlayerController>();
            player.Init(world, cam, spawn, entityMaterial);

            var chunks = new GameObject("Chunks").AddComponent<ChunkRenderer>();
            chunks.radius = viewChunks;
            chunks.Init(world, blockMaterial, player.transform);
            chunks.BuildAround(spawn, 2);

            gameObject.AddComponent<HUD>().Init(player, atlas);
            for (int i = 0; i < pigs + zombies; i++) TrySpawnMob(i < pigs ? MobKind.Pig : MobKind.Zombie, 6, 20);

            // `-screenshot <path>` saves one frame after the world has streamed in, then quits (used for smoke tests).
            var args = System.Environment.GetCommandLineArgs();
            int index = System.Array.IndexOf(args, "-screenshot");
            if (index >= 0 && index + 1 < args.Length) StartCoroutine(CaptureAndQuit(args[index + 1]));
        }

        System.Collections.IEnumerator CaptureAndQuit(string path)
        {
            yield return new WaitForSeconds(4f);
            ScreenCapture.CaptureScreenshot(path);
            yield return new WaitForSeconds(1f);
            Application.Quit();
        }

        Vector3 FindSpawn()
        {
            // Walk outward until we find dry grass with headroom (not a tree top or a beach).
            for (int r = 0; r < 64; r += 2)
                for (int i = 0; i < 8; i++)
                {
                    int x = Mathf.RoundToInt(Mathf.Cos(i * Mathf.PI / 4) * r), z = Mathf.RoundToInt(Mathf.Sin(i * Mathf.PI / 4) * r);
                    int y = world.SurfaceY(x, z);
                    if (world.GetBlock(x, y, z) == Blocks.Grass) return new Vector3(x + .5f, y + 1, z + .5f);
                }
            return new Vector3(.5f, world.SurfaceY(0, 0) + 1, .5f);
        }

        bool TrySpawnMob(MobKind kind, float minDistance, float maxDistance)
        {
            float a = Random.Range(0f, Mathf.PI * 2), d = Random.Range(minDistance, maxDistance);
            var p = player.transform.position;
            int x = Mathf.FloorToInt(p.x + Mathf.Cos(a) * d), z = Mathf.FloorToInt(p.z + Mathf.Sin(a) * d);
            int y = world.SurfaceY(x, z);
            if (world.GetBlock(x, y, z) != Blocks.Grass) return false;
            Mob.Spawn(kind, new Vector3(x + .5f, y + 1, z + .5f), world, player, entityMaterial);
            return true;
        }

        void Update()
        {
            if (player == null) return;
            var p = player.transform.position;
            for (int i = Mob.All.Count - 1; i >= 0; i--)
                if ((Mob.All[i].transform.position - p).sqrMagnitude > 80 * 80 || Mob.All[i].transform.position.y < -30)
                    Destroy(Mob.All[i].gameObject);

            spawnTimer -= Time.deltaTime;
            if (spawnTimer > 0) return;
            spawnTimer = 4f;
            int pigCount = 0, zombieCount = 0;
            foreach (var m in Mob.All) if (m.Kind == MobKind.Pig) pigCount++; else zombieCount++;
            if (pigCount < pigs) TrySpawnMob(MobKind.Pig, 16, 40);
            else if (zombieCount < zombies) TrySpawnMob(MobKind.Zombie, 18, 40);
        }
    }
}
