using NUnit.Framework;
using UnityEngine;
using MineCraft.Core;
using MineCraft.Rendering;

namespace MineCraft.Tests
{
    public class VoxelWorldTests
    {
        // Flat world: bedrock at 0, stone up to 3, grass on top at y=4.
        static VoxelWorld Flat() => new VoxelWorld(chunk =>
        {
            for (int x = 0; x < Chunk.Size; x++)
                for (int z = 0; z < Chunk.Size; z++)
                {
                    chunk.Set(x, 0, z, Blocks.Bedrock);
                    for (int y = 1; y < 4; y++) chunk.Set(x, y, z, Blocks.Stone);
                    chunk.Set(x, 4, z, Blocks.Grass);
                }
        });

        static VoxelWorld Empty() => new VoxelWorld(chunk => { });

        [Test] public void SetAndGetBlocksAcrossNegativeChunkCoordinates()
        {
            var w = Empty();
            w.SetBlock(-1, 10, -17, Blocks.Brick);
            w.SetBlock(16, 10, 0, Blocks.Sand);
            Assert.AreEqual(Blocks.Brick, w.GetBlock(-1, 10, -17));
            Assert.AreEqual(Blocks.Sand, w.GetBlock(16, 10, 0));
            Assert.AreEqual(Blocks.Air, w.GetBlock(0, 10, 0));
            Assert.AreEqual(-1, VoxelWorld.ToChunk(-1));
            Assert.AreEqual(-2, VoxelWorld.ToChunk(-17));
            Assert.AreEqual(1, VoxelWorld.ToChunk(16));
        }

        [Test] public void OutOfRangeHeightsAreBedrockBelowAndAirAbove()
        {
            var w = Empty();
            Assert.AreEqual(Blocks.Bedrock, w.GetBlock(0, -1, 0));
            Assert.AreEqual(Blocks.Air, w.GetBlock(0, Chunk.Height, 0));
            Assert.IsFalse(w.SetBlock(0, Chunk.Height, 0, Blocks.Stone));
        }

        [Test] public void EditingABorderBlockMarksTheNeighbourChunkChanged()
        {
            var w = Empty();
            var changed = new System.Collections.Generic.List<Vector2Int>();
            w.ChunkChanged += (cx, cz) => changed.Add(new Vector2Int(cx, cz));
            w.SetBlock(15, 5, 3, Blocks.Stone);
            CollectionAssert.AreEquivalent(new[] { new Vector2Int(0, 0), new Vector2Int(1, 0) }, changed);
        }

        [Test] public void TerrainIsDeterministicWithBedrockAndNaturalSurface()
        {
            var gen = new TerrainGenerator(7);
            var a = new VoxelWorld(7);
            var b = new VoxelWorld(7);
            for (int i = 0; i < 40; i++)
            {
                int x = i * 13 - 200, z = i * -29 + 50;
                int h = gen.HeightAt(x, z);
                Assert.AreEqual(Blocks.Bedrock, a.GetBlock(x, 0, z));
                Assert.That(a.GetBlock(x, h, z), Is.EqualTo(Blocks.Grass).Or.EqualTo(Blocks.Sand));
                Assert.AreEqual(Blocks.Stone, a.GetBlock(x, 1, z));
                Assert.AreEqual(Blocks.Air, a.GetBlock(x, Chunk.Height - 1, z));
                for (int y = 0; y < Chunk.Height; y += 7) Assert.AreEqual(a.GetBlock(x, y, z), b.GetBlock(x, y, z));
            }
        }

        [Test] public void RaycastHitsTopFaceOfGroundBelow()
        {
            var w = Flat();
            Assert.IsTrue(w.Raycast(new Vector3(2.5f, 8f, 2.5f), Vector3.down, 10f, out var hit, out var normal));
            Assert.AreEqual(new Vector3Int(2, 4, 2), hit);
            Assert.AreEqual(Vector3Int.up, normal);
            Assert.IsFalse(w.Raycast(new Vector3(2.5f, 8f, 2.5f), Vector3.up, 10f, out _, out _));
            Assert.IsFalse(w.Raycast(new Vector3(2.5f, 20f, 2.5f), Vector3.down, 5f, out _, out _));
        }

        [Test] public void FallingBodyLandsOnTopOfGround()
        {
            var w = Flat();
            var feet = new Vector3(3.5f, 9f, 3.5f);
            bool grounded = false;
            for (int i = 0; i < 100; i++)
            {
                feet = VoxelPhysics.Move(w, feet, .3f, 1.8f, new Vector3(0, -.5f, 0), out var r);
                grounded |= r.HitBelow;
            }
            Assert.IsTrue(grounded);
            Assert.AreEqual(5f, feet.y, 1e-3f);
        }

        [Test] public void WallsStopHorizontalMovementAndSurfacesAreClimbableByJump()
        {
            var w = Flat();
            for (int y = 5; y < 8; y++) w.SetBlock(6, y, 3, Blocks.Stone);
            var feet = new Vector3(4.5f, 5f, 3.5f);
            feet = VoxelPhysics.Move(w, feet, .3f, 1.8f, new Vector3(3f, 0, 0), out var r);
            Assert.IsTrue(r.HitSide);
            Assert.Less(feet.x + .3f, 6f + 1e-4f);
            Assert.Greater(feet.x, 5.5f);
            Assert.IsFalse(VoxelPhysics.Overlaps(w, feet, .3f, 1.8f));
        }

        [Test] public void RayHitsBoxFromOutside()
        {
            var bounds = new Bounds(new Vector3(0, 1, 5), new Vector3(1, 2, 1));
            Assert.IsTrue(VoxelPhysics.RayBox(new Vector3(0, 1, 0), Vector3.forward, bounds, 10f, out float d));
            Assert.AreEqual(4.5f, d, 1e-4f);
            Assert.IsFalse(VoxelPhysics.RayBox(new Vector3(0, 1, 0), Vector3.back, bounds, 10f, out _));
            Assert.IsFalse(VoxelPhysics.RayBox(new Vector3(0, 1, 0), Vector3.forward, bounds, 3f, out _));
        }

        [Test] public void SingleBlockMeshHasSixOutwardFacingQuads()
        {
            var w = Empty();
            w.SetBlock(5, 5, 5, Blocks.Stone);
            var mesh = VoxelMesh.Build(w, w.GetChunk(0, 0));
            Assert.AreEqual(24, mesh.vertexCount);
            Assert.AreEqual(36, mesh.triangles.Length);
            mesh.RecalculateNormals();
            var verts = mesh.vertices; var normals = mesh.normals;
            var center = new Vector3(5.5f, 5.5f, 5.5f);
            for (int i = 0; i < verts.Length; i++)
                Assert.Greater(Vector3.Dot(normals[i], verts[i] - center), 0f, "face {0} points inward", i / 4);
        }

        [Test] public void HiddenFacesBetweenOpaqueBlocksAreCulled()
        {
            var w = Empty();
            w.SetBlock(5, 5, 5, Blocks.Stone);
            w.SetBlock(6, 5, 5, Blocks.Dirt);
            Assert.AreEqual(40, VoxelMesh.Build(w, w.GetChunk(0, 0)).vertexCount);
            // Glass does not hide the stone face behind it, but the stone hides the glass face.
            w.SetBlock(6, 5, 5, Blocks.Glass);
            Assert.AreEqual(44,VoxelMesh.Build(w, w.GetChunk(0, 0)).vertexCount);
        }

        [Test] public void FacesOnChunkBordersCheckTheNeighbourChunk()
        {
            var w = Empty();
            w.SetBlock(15, 5, 5, Blocks.Stone);
            w.SetBlock(16, 5, 5, Blocks.Stone);
            Assert.AreEqual(20, VoxelMesh.Build(w, w.GetChunk(0, 0)).vertexCount);
        }
    }
}
