using System.Collections.Generic;
using UnityEngine;

namespace MineCraft.Rendering
{
    // Builds meshes out of coloured boxes for mobs and the block selection outline.
    public sealed class BoxMesh
    {
        static readonly Vector3[][] corners =
        {
            new[] { new Vector3(0, 1, 0), new Vector3(0, 1, 1), new Vector3(1, 1, 1), new Vector3(1, 1, 0) },
            new[] { new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(1, 0, 1), new Vector3(0, 0, 1) },
            new[] { new Vector3(1, 0, 1), new Vector3(1, 1, 1), new Vector3(0, 1, 1), new Vector3(0, 0, 1) },
            new[] { new Vector3(0, 0, 0), new Vector3(0, 1, 0), new Vector3(1, 1, 0), new Vector3(1, 0, 0) },
            new[] { new Vector3(1, 0, 0), new Vector3(1, 1, 0), new Vector3(1, 1, 1), new Vector3(1, 0, 1) },
            new[] { new Vector3(0, 0, 1), new Vector3(0, 1, 1), new Vector3(0, 1, 0), new Vector3(0, 0, 0) },
        };
        static readonly float[] shade = { 1f, .55f, .8f, .8f, .68f, .68f };

        readonly List<Vector3> verts = new List<Vector3>();
        readonly List<Color> colors = new List<Color>();
        readonly List<int> tris = new List<int>();

        public BoxMesh Add(Vector3 min, Vector3 size, Color color)
        {
            for (int f = 0; f < 6; f++)
            {
                int start = verts.Count;
                foreach (var c in corners[f])
                {
                    verts.Add(min + Vector3.Scale(c, size));
                    colors.Add(new Color(color.r * shade[f], color.g * shade[f], color.b * shade[f], 1));
                }
                tris.Add(start); tris.Add(start + 1); tris.Add(start + 2);
                tris.Add(start); tris.Add(start + 2); tris.Add(start + 3);
            }
            return this;
        }

        public Mesh ToMesh(string name)
        {
            var mesh = new Mesh { name = name };
            mesh.SetVertices(verts);
            mesh.SetColors(colors);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateBounds();
            return mesh;
        }

        // Twelve thin bars along the edges of a slightly enlarged unit cube.
        public static Mesh Outline()
        {
            const float t = .02f, lo = -.005f, len = 1.01f;
            var box = new BoxMesh();
            var black = new Color(.08f, .08f, .08f);
            for (int a = 0; a < 2; a++)
                for (int b = 0; b < 2; b++)
                {
                    float p = lo + a * (len - t), q = lo + b * (len - t);
                    box.Add(new Vector3(lo, p, q), new Vector3(len, t, t), black);
                    box.Add(new Vector3(p, lo, q), new Vector3(t, len, t), black);
                    box.Add(new Vector3(p, q, lo), new Vector3(t, t, len), black);
                }
            return box.ToMesh("Selection Outline");
        }
    }
}
