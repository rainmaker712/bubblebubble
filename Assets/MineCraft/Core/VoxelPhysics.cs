using UnityEngine;

namespace MineCraft.Core
{
    public struct MoveResult { public bool HitBelow, HitAbove, HitSide; }

    // Axis-aligned box vs voxel grid collision. The box is described by its feet (bottom centre),
    // half width on x/z and height, matching how Minecraft entities are sized.
    public static class VoxelPhysics
    {
        const float Skin = .001f;

        public static bool Overlaps(VoxelWorld world, Vector3 feet, float halfWidth, float height)
        {
            int x0 = Mathf.FloorToInt(feet.x - halfWidth), x1 = Mathf.FloorToInt(feet.x + halfWidth - 1e-4f);
            int y0 = Mathf.FloorToInt(feet.y), y1 = Mathf.FloorToInt(feet.y + height - 1e-4f);
            int z0 = Mathf.FloorToInt(feet.z - halfWidth), z1 = Mathf.FloorToInt(feet.z + halfWidth - 1e-4f);
            for (int x = x0; x <= x1; x++)
                for (int y = y0; y <= y1; y++)
                    for (int z = z0; z <= z1; z++)
                        if (world.IsSolid(x, y, z)) return true;
            return false;
        }

        public static Vector3 Move(VoxelWorld world, Vector3 feet, float halfWidth, float height, Vector3 delta, out MoveResult result)
        {
            result = default;
            int steps = Mathf.Max(1, Mathf.CeilToInt(delta.magnitude / .4f));
            Vector3 step = delta / steps;
            for (int i = 0; i < steps; i++)
            {
                feet = MoveAxis(world, feet, halfWidth, height, 1, step.y, ref result);
                feet = MoveAxis(world, feet, halfWidth, height, 0, step.x, ref result);
                feet = MoveAxis(world, feet, halfWidth, height, 2, step.z, ref result);
            }
            return feet;
        }

        static Vector3 MoveAxis(VoxelWorld world, Vector3 feet, float hw, float height, int axis, float d, ref MoveResult result)
        {
            if (d == 0) return feet;
            Vector3 next = feet;
            next[axis] += d;
            if (!Overlaps(world, next, hw, height)) return next;
            if (axis == 1)
            {
                if (d < 0) { next.y = Mathf.Floor(next.y) + 1; result.HitBelow = true; }
                else { next.y = Mathf.Floor(next.y + height) - height - Skin; result.HitAbove = true; }
            }
            else
            {
                next[axis] = d > 0 ? Mathf.Floor(next[axis] + hw) - hw - Skin : Mathf.Floor(next[axis] - hw) + 1 + hw + Skin;
                result.HitSide = true;
            }
            return Overlaps(world, next, hw, height) ? feet : next;
        }

        // Slab test; distance is where the ray enters the box.
        public static bool RayBox(Vector3 origin, Vector3 direction, Bounds box, float maxDistance, out float distance)
        {
            direction.Normalize();
            float tMin = 0, tMax = maxDistance;
            for (int i = 0; i < 3; i++)
            {
                if (Mathf.Abs(direction[i]) < 1e-6f)
                {
                    if (origin[i] < box.min[i] || origin[i] > box.max[i]) { distance = 0; return false; }
                    continue;
                }
                float inv = 1f / direction[i];
                float t0 = (box.min[i] - origin[i]) * inv, t1 = (box.max[i] - origin[i]) * inv;
                if (t0 > t1) (t0, t1) = (t1, t0);
                tMin = Mathf.Max(tMin, t0);
                tMax = Mathf.Min(tMax, t1);
                if (tMin > tMax) { distance = 0; return false; }
            }
            distance = tMin;
            return true;
        }
    }
}
