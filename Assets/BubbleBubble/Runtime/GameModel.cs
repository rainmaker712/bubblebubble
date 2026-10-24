using System;
using System.Collections.Generic;
using System.Linq;

namespace BubbleBubble
{
    // JSON field names deliberately match the original ten stage files.
    [Serializable] public class Tile { public int x, y; }
    [Serializable] public class StageTheme { public string background, music; public string[] palette; }
    [Serializable] public class PlayerSpawn { public int player; public string character; public Tile tile; }
    [Serializable] public class EnemySpawn { public string id, kind, behavior; public Tile tile; }
    [Serializable] public class ItemSpawn { public string id, kind; public Tile tile; }
    [Serializable] public class BossSpawn { public string name; public int hp; public Tile tile; }
    [Serializable] public class TileRect { public int x, y, width, height; }
    [Serializable] public class FlowDirection { public float x, y; }
    [Serializable] public class Airflow { public TileRect tileRect; public FlowDirection direction; }
    [Serializable] public class StageRules { public int startingLives, timeLimitSeconds, enrageAtSecondsRemaining; }
    [Serializable] public class StageData
    {
        public string id, title;
        public StageTheme theme;
        public string[] layout;
        public PlayerSpawn[] playerSpawns;
        public EnemySpawn[] enemies;
        public ItemSpawn[] items;
        public Airflow[] airflow;
        public BossSpawn boss;
        public StageRules rules;
    }
    public enum GamePhase { Menu, Playing, Paused, Continue, StageClear, Victory, GameOver }
    public struct PlayerInput { public float move; public bool jumpPressed, jumpHeld, fire; }
    public class Powers
    {
        public string element;
        public bool speed, shield, flight, rainbow, star;
        public int rainbowCharges;
        readonly HashSet<int> previous = new HashSet<int>();
        public bool Protect(IEnumerable<int> touching)
        {
            var contacts = new HashSet<int>(touching);
            bool protectedNow = rainbowCharges > 0;
            if (protectedNow) rainbowCharges = Math.Max(0, rainbowCharges - contacts.Count(id => !previous.Contains(id)));
            previous.Clear(); previous.UnionWith(contacts);
            return protectedNow;
        }
        public void ClearContacts() { previous.Clear(); }
        public void Grant(string kind)
        {
            switch (kind)
            {
                case "water": case "fire": case "lightning": element = kind; break;
                case "shoes": speed = true; break;
                case "shield": shield = true; break;
                case "cloud": flight = true; break;
                case "rainbow": rainbow = true; rainbowCharges = 10; previous.Clear(); break;
                case "shootingStar": star = true; break;
            }
        }
    }
    public class Actor
    {
        public int id;
        public float x, y, vx, vy, width = 28, height = 28, halfX = 11, halfY = 12;
        public string art;
        public bool alive = true, grounded, flip;
    }
    public class Player : Actor
    {
        public int index, lives, facing = 1;
        public bool jumpHeld;
        public float spawnX, spawnY, cooldown, invulnerable;
        public Powers powers = new Powers();
        public bool Dead => lives <= 0;
    }
    public class Enemy : Actor
    {
        public string kind, behavior, normalArt;
        public bool captured, defeated, enraged;
        public int direction = 1;
        public float decisionIn, jumpIn;
    }
    public class Bubble : Actor
    {
        public int owner;
        public string element;
        public bool rainbow;
        public float age, driftAt, life = 5.2f, capturedFor;
        public Enemy enemy;
    }
    public class Drop : Actor { public string kind; public int value; public bool power, letter; public float originY; }
    public class Boss : Actor { public string kind, displayName; public int hp, maxHp, attackIndex; public float elapsed, attackIn = 3, hurtFor; }
    public class Hazard : Actor { public string kind; public float delay, life; public bool Active => delay <= 0; }
    public class Star : Actor { public Enemy target; public float age, fromX, fromY, targetX, targetY; }
    public class Spark : Actor { public float life, initialLife; public int color; }

    public static class GameRules
    {
        public const float Width = 512, Height = 448, TileSize = 32, Gravity = 840;
        public static int BossDamage(string element) => element == "fire" ? 3 : element == "lightning" ? 2 : 1;
        public static float Clamp(float v, float min, float max) => Math.Max(min, Math.Min(max, v));
        public static float Distance(Actor a, Actor b) { float x = a.x - b.x, y = a.y - b.y; return (float)Math.Sqrt(x * x + y * y); }
        public static bool Touch(Actor a, Actor b) => Math.Abs(a.x - b.x) < a.halfX + b.halfX && Math.Abs(a.y - b.y) < a.halfY + b.halfY;
        public static string PowerName(string kind)
        {
            switch (kind) {
                case "water": return "물방울"; case "fire": return "불꽃"; case "lightning": return "번개";
                case "shoes": return "스피드 신발"; case "shield": return "보호 방패"; case "cloud": return "비행 구름";
                case "rainbow": return "무지개"; case "shootingStar": return "별똥별"; case "trash": return "쓰레기통 · 위험!"; case "poop": return "똥 · 물고기 부하 주의!"; default: return kind;
            }
        }
    }
}
