using System.Collections.Generic;
using UnityEngine;
using MineCraft.Core;
using MineCraft.Rendering;

namespace MineCraft.Entities
{
    public enum MobKind { Pig, Zombie }

    public sealed class Mob : MonoBehaviour
    {
        public static readonly List<Mob> All = new List<Mob>();
        const float Gravity = -28f, JumpSpeed = 8.6f;

        public MobKind Kind { get; private set; }
        public float Health { get; private set; }
        float halfWidth, height, speed, yaw, wanderTimer, attackCooldown, hurtTimer;
        Vector3 velocity, wander;
        bool grounded;
        VoxelWorld world;
        PlayerController player;
        Material material;

        public Bounds Bounds => new Bounds(transform.position + Vector3.up * height / 2, new Vector3(halfWidth * 2, height, halfWidth * 2));

        public static Mob Spawn(MobKind kind, Vector3 feet, VoxelWorld world, PlayerController player, Material template)
        {
            var go = new GameObject(kind.ToString());
            go.transform.position = feet;
            var mob = go.AddComponent<Mob>();
            mob.Kind = kind; mob.world = world; mob.player = player;
            mob.material = new Material(template);
            go.AddComponent<MeshFilter>().sharedMesh = kind == MobKind.Pig ? PigMesh() : ZombieMesh();
            go.AddComponent<MeshRenderer>().sharedMaterial = mob.material;
            if (kind == MobKind.Pig) { mob.Health = 10; mob.halfWidth = .45f; mob.height = .9f; mob.speed = 1.4f; }
            else { mob.Health = 20; mob.halfWidth = .3f; mob.height = 1.9f; mob.speed = 2.4f; }
            mob.yaw = Random.Range(0f, 360f);
            return mob;
        }

        void OnEnable() => All.Add(this);
        void OnDisable() => All.Remove(this);
        void OnDestroy() { if (material != null) Destroy(material); }

        public void Hit(float damage, Vector3 from)
        {
            Health -= damage;
            hurtTimer = .3f;
            var push = transform.position - from; push.y = 0;
            velocity = push.normalized * 7f + Vector3.up * 5f;
            wanderTimer = 0;
            if (Health <= 0) Destroy(gameObject);
        }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, .05f);
            hurtTimer -= dt; attackCooldown -= dt; wanderTimer -= dt;
            material.color = hurtTimer > 0 ? new Color(1f, .45f, .45f) : Color.white;

            Vector3 wish = Vector3.zero;
            var toPlayer = player.transform.position - transform.position;
            toPlayer.y = 0;
            if (Kind == MobKind.Zombie && toPlayer.magnitude < 16f)
            {
                wish = toPlayer.normalized;
                if (toPlayer.magnitude < 1.1f && Mathf.Abs(player.transform.position.y - transform.position.y) < 1.5f && attackCooldown <= 0)
                {
                    player.TakeDamage(3, transform.position);
                    attackCooldown = 1f;
                }
            }
            else
            {
                if (wanderTimer <= 0)
                {
                    wanderTimer = Random.Range(2f, 5f);
                    float a = Random.Range(0f, Mathf.PI * 2);
                    wander = Random.value < .35f ? Vector3.zero : new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                }
                wish = wander;
            }
            if (Kind == MobKind.Zombie && toPlayer.magnitude < 1f) wish = Vector3.zero;

            if (hurtTimer <= 0)
            {
                var h = Vector3.Lerp(new Vector3(velocity.x, 0, velocity.z), wish * speed, 1 - Mathf.Exp(-8 * dt));
                velocity.x = h.x; velocity.z = h.z;
            }
            velocity.y = Mathf.Max(velocity.y + Gravity * dt, -50f);
            transform.position = VoxelPhysics.Move(world, transform.position, halfWidth, height, velocity * dt, out var hit);
            if (hit.HitBelow || hit.HitAbove) velocity.y = 0;
            grounded = hit.HitBelow;
            if (grounded && hit.HitSide && wish != Vector3.zero) velocity.y = JumpSpeed;

            if (wish.sqrMagnitude > .01f) yaw = Mathf.MoveTowardsAngle(yaw, Mathf.Atan2(wish.x, wish.z) * Mathf.Rad2Deg, 360 * dt);
            transform.rotation = Quaternion.Euler(0, yaw, 0);
        }

        static Mesh pigMesh, zombieMesh;

        // Models face +z with their feet at the origin.
        static Mesh PigMesh()
        {
            if (pigMesh != null) return pigMesh;
            var pink = new Color(.94f, .62f, .62f);
            var b = new BoxMesh()
                .Add(new Vector3(-.45f, .35f, -.55f), new Vector3(.9f, .55f, 1.1f), pink)
                .Add(new Vector3(-.3f, .45f, .5f), new Vector3(.6f, .5f, .45f), pink)
                .Add(new Vector3(-.15f, .52f, .94f), new Vector3(.3f, .2f, .08f), new Color(.85f, .45f, .5f))
                .Add(new Vector3(-.22f, .78f, .945f), new Vector3(.09f, .09f, .02f), Color.black)
                .Add(new Vector3(.13f, .78f, .945f), new Vector3(.09f, .09f, .02f), Color.black);
            foreach (var x in new[] { -.4f, .2f })
                foreach (var z in new[] { -.5f, .3f })
                    b.Add(new Vector3(x, 0, z), new Vector3(.2f, .35f, .2f), pink * .9f);
            return pigMesh = b.ToMesh("Pig");
        }

        static Mesh ZombieMesh()
        {
            if (zombieMesh != null) return zombieMesh;
            var skin = new Color(.33f, .58f, .3f);
            var shirt = new Color(.1f, .62f, .66f);
            var pants = new Color(.25f, .22f, .55f);
            return zombieMesh = new BoxMesh()
                .Add(new Vector3(-.25f, 0, -.12f), new Vector3(.24f, .75f, .24f), pants)
                .Add(new Vector3(.01f, 0, -.12f), new Vector3(.24f, .75f, .24f), pants)
                .Add(new Vector3(-.25f, .75f, -.13f), new Vector3(.5f, .7f, .26f), shirt)
                .Add(new Vector3(-.5f, 1.2f, -.12f), new Vector3(.24f, .24f, .75f), skin)
                .Add(new Vector3(.26f, 1.2f, -.12f), new Vector3(.24f, .24f, .75f), skin)
                .Add(new Vector3(-.25f, 1.45f, -.25f), new Vector3(.5f, .5f, .5f), skin)
                .Add(new Vector3(-.17f, 1.68f, .25f), new Vector3(.1f, .07f, .02f), Color.black)
                .Add(new Vector3(.07f, 1.68f, .25f), new Vector3(.1f, .07f, .02f), Color.black)
                .ToMesh("Zombie");
        }
    }
}
