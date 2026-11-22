using System;
using UnityEngine;
using MineCraft.Core;
using MineCraft.Rendering;

namespace MineCraft.Entities
{
    public sealed class PlayerController : MonoBehaviour
    {
        public const float HalfWidth = .3f, Height = 1.8f, EyeHeight = 1.62f, Reach = 5.5f, MaxHealth = 20;
        const float Gravity = -28f, JumpSpeed = 8.6f, WalkSpeed = 4.3f, SprintSpeed = 6.2f, FlySpeed = 11f;
        const float MouseSensitivity = 2.2f, BreakRepeat = .25f, PlaceRepeat = .22f;

        public static readonly byte[] Hotbar =
        {
            Blocks.Grass, Blocks.Dirt, Blocks.Stone, Blocks.Cobblestone, Blocks.Planks,
            Blocks.Log, Blocks.Glass, Blocks.Brick, Blocks.Sand
        };

        public float Health { get; private set; } = MaxHealth;
        public int Selected { get; private set; }
        public bool Flying { get; private set; }
        public bool CursorLocked => Cursor.lockState == CursorLockMode.Locked;
        public float HurtFlash { get; private set; }
        public string Message { get; private set; }
        public float MessageTime { get; private set; }

        VoxelWorld world;
        Camera cam;
        Transform outline;
        Vector3 spawn, velocity;
        float yaw, pitch, breakCooldown, placeCooldown, fallStartY, lastSpaceTap = -1;
        bool grounded;

        public void Init(VoxelWorld world, Camera cam, Vector3 spawn, Material outlineMaterial)
        {
            this.world = world; this.cam = cam; this.spawn = spawn;
            transform.position = spawn;
            fallStartY = spawn.y;
            cam.transform.SetParent(transform, false);
            cam.transform.localPosition = new Vector3(0, EyeHeight, 0);
            var go = new GameObject("Selection");
            go.AddComponent<MeshFilter>().sharedMesh = BoxMesh.Outline();
            go.AddComponent<MeshRenderer>().sharedMaterial = outlineMaterial;
            outline = go.transform;
            outline.gameObject.SetActive(false);
        }

        public Vector3 Eye => transform.position + Vector3.up * EyeHeight;
        public Bounds Bounds => new Bounds(transform.position + Vector3.up * Height / 2, new Vector3(HalfWidth * 2, Height, HalfWidth * 2));

        public void Say(string text) { Message = text; MessageTime = Time.time; }

        public void TakeDamage(float amount, Vector3 from)
        {
            if (Health <= 0) return;
            Health = Mathf.Max(0, Health - amount);
            HurtFlash = 1;
            var push = transform.position - from; push.y = 0;
            if (push.sqrMagnitude > 1e-4f) velocity += push.normalized * 6f;
            velocity.y = Mathf.Max(velocity.y, 4f);
            if (Health <= 0) Respawn("쓰러졌습니다! 스폰 지점에서 다시 시작합니다.");
        }

        void Respawn(string reason)
        {
            transform.position = spawn;
            velocity = Vector3.zero;
            fallStartY = spawn.y;
            Health = MaxHealth;
            Say(reason);
        }

        void Update()
        {
            if (world == null) return;
            float dt = Mathf.Min(Time.deltaTime, .05f);
            HurtFlash = Mathf.Max(0, HurtFlash - dt * 2.5f);
            bool justLocked = HandleCursor();
            if (CursorLocked)
            {
                yaw += Input.GetAxisRaw("Mouse X") * MouseSensitivity;
                pitch = Mathf.Clamp(pitch - Input.GetAxisRaw("Mouse Y") * MouseSensitivity, -89f, 89f);
            }
            transform.rotation = Quaternion.Euler(0, yaw, 0);
            cam.transform.localRotation = Quaternion.Euler(pitch, 0, 0);

            HandleHotbar();
            Move(dt);
            UpdateTarget(justLocked, dt);
        }

        bool HandleCursor()
        {
            if (Input.GetKeyDown(KeyCode.Escape)) { Cursor.lockState = CursorLockMode.None; Cursor.visible = true; }
            if (!CursorLocked && (Input.GetMouseButtonDown(0) || Input.GetMouseButtonDown(1)))
            {
                Cursor.lockState = CursorLockMode.Locked; Cursor.visible = false;
                return true;
            }
            return false;
        }

        void HandleHotbar()
        {
            for (int i = 0; i < Hotbar.Length; i++)
                if (Input.GetKeyDown(KeyCode.Alpha1 + i)) Selected = i;
            float scroll = Input.mouseScrollDelta.y;
            if (scroll < 0) Selected = (Selected + 1) % Hotbar.Length;
            else if (scroll > 0) Selected = (Selected + Hotbar.Length - 1) % Hotbar.Length;
        }

        void Move(float dt)
        {
            bool keys = CursorLocked;
            float forward = keys ? (Input.GetKey(KeyCode.W) ? 1 : 0) - (Input.GetKey(KeyCode.S) ? 1 : 0) : 0;
            float strafe = keys ? (Input.GetKey(KeyCode.D) ? 1 : 0) - (Input.GetKey(KeyCode.A) ? 1 : 0) : 0;
            var wish = transform.rotation * new Vector3(strafe, 0, forward);
            if (wish.sqrMagnitude > 1) wish.Normalize();
            bool sprint = keys && (Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.LeftControl)) && forward > 0;

            if (keys && Input.GetKeyDown(KeyCode.F)) ToggleFly();
            if (keys && Input.GetKeyDown(KeyCode.Space))
            {
                // Double-tap space also toggles flying, like Minecraft creative mode.
                if (Time.time - lastSpaceTap < .3f) { ToggleFly(); lastSpaceTap = -1; }
                else lastSpaceTap = Time.time;
            }

            if (Flying)
            {
                float vertical = keys ? (Input.GetKey(KeyCode.Space) ? 1 : 0) - (Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.C) ? 1 : 0) : 0;
                var target = wish * FlySpeed * (keys && Input.GetKey(KeyCode.LeftControl) ? 2 : 1) + Vector3.up * vertical * FlySpeed * .7f;
                velocity = Vector3.Lerp(velocity, target, 1 - Mathf.Exp(-10 * dt));
            }
            else
            {
                float speed = sprint ? SprintSpeed : WalkSpeed;
                var horizontal = new Vector3(velocity.x, 0, velocity.z);
                float control = grounded ? 14 : 3;
                horizontal = Vector3.Lerp(horizontal, wish * speed, 1 - Mathf.Exp(-control * dt));
                velocity = new Vector3(horizontal.x, velocity.y + Gravity * dt, horizontal.z);
                velocity.y = Mathf.Max(velocity.y, -50f);
                if (keys && grounded && Input.GetKey(KeyCode.Space)) velocity.y = JumpSpeed;
            }

            transform.position = VoxelPhysics.Move(world, transform.position, HalfWidth, Height, velocity * dt, out var hit);
            bool wasGrounded = grounded;
            grounded = hit.HitBelow;
            if (hit.HitBelow || hit.HitAbove) velocity.y = 0;
            if (Flying && grounded) Flying = false;

            if (!grounded || Flying) fallStartY = Mathf.Max(Flying ? transform.position.y : fallStartY, transform.position.y);
            if (grounded && !wasGrounded)
            {
                float fall = fallStartY - transform.position.y;
                if (fall > 3.5f) TakeDamage(Mathf.Floor(fall - 3), transform.position);
            }
            if (grounded) fallStartY = transform.position.y;
            if (transform.position.y < -30) Respawn("세상 밖으로 떨어졌습니다!");
        }

        void ToggleFly()
        {
            Flying = !Flying;
            velocity.y = 0;
            Say(Flying ? "비행 모드 켜짐" : "비행 모드 꺼짐");
        }

        void UpdateTarget(bool justLocked, float dt)
        {
            breakCooldown -= dt; placeCooldown -= dt;
            var ray = new Ray(cam.transform.position, cam.transform.forward);
            bool hasBlock = world.Raycast(ray.origin, ray.direction, Reach, out var block, out var normal);
            float blockDistance = hasBlock ? Vector3.Distance(ray.origin, block + Vector3.one * .5f) : float.MaxValue;

            Mob mob = null; float mobDistance = float.MaxValue;
            foreach (var m in Mob.All)
                if (VoxelPhysics.RayBox(ray.origin, ray.direction, m.Bounds, 4f, out float d) && d < mobDistance) { mob = m; mobDistance = d; }
            if (mob != null && mobDistance > blockDistance) mob = null;

            outline.gameObject.SetActive(hasBlock && mob == null);
            if (hasBlock) outline.position = block;
            if (!CursorLocked || justLocked) return;

            if (Input.GetMouseButtonDown(0) && mob != null) { mob.Hit(4, transform.position); breakCooldown = BreakRepeat; return; }
            if (Input.GetMouseButton(0) && breakCooldown <= 0 && hasBlock && mob == null)
            {
                breakCooldown = BreakRepeat;
                if (Blocks.IsBreakable(world.GetBlock(block.x, block.y, block.z))) world.SetBlock(block.x, block.y, block.z, Blocks.Air);
            }
            if (!Input.GetMouseButton(0)) breakCooldown = Mathf.Min(breakCooldown, 0);

            if (Input.GetMouseButton(1) && placeCooldown <= 0 && hasBlock)
            {
                placeCooldown = PlaceRepeat;
                var p = block + normal;
                var cell = new Bounds(p + Vector3.one * .5f, Vector3.one * .999f);
                bool blocked = cell.Intersects(Bounds);
                foreach (var m in Mob.All) blocked |= cell.Intersects(m.Bounds);
                if (!blocked && world.GetBlock(p.x, p.y, p.z) == Blocks.Air) world.SetBlock(p.x, p.y, p.z, Hotbar[Selected]);
            }
            if (!Input.GetMouseButton(1)) placeCooldown = Mathf.Min(placeCooldown, 0);
        }

        public string Coordinates => FormattableString.Invariant($"{transform.position.x:0.0} / {transform.position.y:0.0} / {transform.position.z:0.0}");
    }
}
