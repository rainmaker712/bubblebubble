using System;
using System.Collections.Generic;
using System.Linq;
using static BubbleBubble.GameRules;

namespace BubbleBubble
{
    /// <summary>Fixed-step gameplay simulation. No Unity object or wall-clock dependencies.</summary>
    public sealed class GameWorld
    {
        public readonly StageData[] Stages;
        public readonly List<Player> Players = new List<Player>();
        public readonly List<Enemy> Enemies = new List<Enemy>();
        public readonly List<Bubble> Bubbles = new List<Bubble>();
        public readonly List<Drop> Items = new List<Drop>(), Drops = new List<Drop>();
        public readonly List<Hazard> Hazards = new List<Hazard>();
        public readonly List<Star> Stars = new List<Star>();
        public readonly List<Spark> Sparks = new List<Spark>();
        public readonly HashSet<char> ExitLetters = new HashSet<char>();
        public Boss Boss { get; private set; }
        public Actor Whale { get; private set; }
        public GamePhase Phase { get; private set; } = GamePhase.Menu;
        public int StageIndex { get; private set; }
        public int Score { get; private set; }
        public float TimeLeft { get; private set; }
        public float Elapsed { get; private set; }
        public float PhaseTime { get; private set; }
        public string Notice { get; private set; } = "달빛 아래, 거품 모험";
        public float NoticeTime { get; private set; }
        public StageData Stage => Stages[StageIndex];
        public bool Danger => (TimeLeft <= 0 || Whale != null) && Phase != GamePhase.Menu;
        readonly Random random;
        int nextId, count = 1, nextLetter;
        float nextLetterAt, nextItemAt;
        int itemsSpawned, starsSpawned;
        static readonly string[] NormalItemPool = { "water", "fire", "lightning", "shoes", "shield", "cloud", "rainbow", "shootingStar", "trash" };
        static readonly string[] BossItemPool = { "fire", "lightning", "water", "shield", "cloud", "rainbow", "trash" };
        public GameWorld(StageData[] stages, int seed = 1)
        {
            if (stages == null || stages.Length == 0) throw new ArgumentException("Stages are required.");
            Stages = stages; random = new Random(seed);
        }
        T Create<T>(string art, float x, float y, float w = 28, float h = 28) where T : Actor, new()
            => new T { id = ++nextId, art = art, x = x, y = y, width = w, height = h };
        public void Start(int players)
        {
            count = Math.Max(1, Math.Min(2, players)); Score = 0; Players.Clear(); LoadStage(0);
        }
        public void LoadStage(int index)
        {
            if(index < 0 || index >= Stages.Length) throw new ArgumentOutOfRangeException(nameof(index));
            StageIndex = index; Elapsed = 0; TimeLeft = Stage.rules.timeLimitSeconds; PhaseTime = 0;
            Enemies.Clear(); Bubbles.Clear(); Items.Clear(); Drops.Clear(); Hazards.Clear(); Stars.Clear(); Sparks.Clear();
            ExitLetters.Clear(); nextLetter = 0; nextLetterAt = 12; Whale = null; Boss = null;
            var old = Players.ToArray(); Players.Clear();
            for (int i = 0; i < count; i++)
            {
                var spawn = Stage.playerSpawns[i];
                var p = Create<Player>(spawn.character, spawn.tile.x * 32 + 16, spawn.tile.y * 32 + 16, 38, 40);
                p.index = i; p.spawnX = p.x; p.spawnY = p.y; p.halfX = 10; p.halfY = 14; p.facing = i == 0 ? 1 : -1;
                p.lives = i < old.Length ? Math.Max(1, old[i].lives) : Stage.rules.startingLives;
                p.powers = new Powers(); // Effects belong only to the stage where they were collected.
                Players.Add(p);
            }
            for (int i = 0; i < Stage.enemies.Length; i++)
            {
                var spawn = Stage.enemies[i];
                var e = Create<Enemy>($"ghost_enemy-v{(i + index * 2) % 8}", spawn.tile.x * 32 + 16, spawn.tile.y * 32 + 16, 30, 34);
                e.kind = spawn.kind; e.behavior = spawn.behavior; e.normalArt = e.art;
                e.direction = spawn.kind == "ghost_bubblun" ? 1 : -1; Enemies.Add(e);
            }
            itemsSpawned = starsSpawned = 0;
            nextItemAt = 4 + (float)random.NextDouble() * 4;
            if (Stage.boss != null && Stage.boss.hp > 0)
            {
                int variant = random.Next(3);
                string[] kinds = { "lightning", "fire", "ice" };
                string[] names = { "번개 왕", "불꽃 왕", "얼음 왕" };
                string[] artwork = { "boss-king", "boss-ember-king", "boss-frost-king" };
                Boss = Create<Boss>(artwork[variant], Stage.boss.tile.x * 32 + 16, Stage.boss.tile.y * 32 + 16, 96, 96);
                Boss.kind = kinds[variant]; Boss.displayName = names[variant];
                Boss.hp = Boss.maxHp = Stage.boss.hp + (count == 2 ? 12 : 0); Boss.halfX = 35; Boss.halfY = 36;
            }
            Phase = GamePhase.Playing;
            Tell(Boss != null ? $"마지막 대결! {Boss.displayName} 등장!" : $"STAGE {index + 1} · {Stage.title}", 2.2f);
        }
        public void TogglePause()
        {
            if (Phase == GamePhase.Playing) Phase = GamePhase.Paused;
            else if (Phase == GamePhase.Paused) Phase = GamePhase.Playing;
        }
        public void ReturnToMenu() { Phase = GamePhase.Menu; }
        public void Tell(string message, float seconds = 1.8f) { Notice = message; NoticeTime = seconds; }
        public void Tick(float dt, PlayerInput[] inputs)
        {
            if (dt <= 0) return;
            if (Phase == GamePhase.Continue) { PhaseTime -= dt; if (PhaseTime <= 0) Phase = GamePhase.GameOver; return; }
            if (Phase == GamePhase.StageClear) { PhaseTime -= dt; if (PhaseTime <= 0) LoadStage(StageIndex + 1); return; }
            if (Phase != GamePhase.Playing) return;
            dt = Math.Min(dt, .04f); Elapsed += dt; TimeLeft = Math.Max(0, TimeLeft - dt); NoticeTime = Math.Max(0, NoticeTime - dt);
            foreach (var p in Players) UpdatePlayer(p, inputs != null && p.index < inputs.Length ? inputs[p.index] : default(PlayerInput), dt);
            foreach (var e in Enemies) UpdateEnemy(e, dt);
            UpdateBoss(dt); UpdateWhale(dt); UpdateItemSpawns();
            foreach (var b in Bubbles) UpdateBubble(b, dt);
            foreach (var h in Hazards) { h.delay -= dt; if (h.Active) { h.life -= dt; h.x += h.vx * dt; h.y += h.vy * dt; if(h.life <= 0 || h.x < 20 || h.x > 492 || h.y < 30 || h.y > 430) h.alive = false; } }
            foreach (var item in Items) item.y = item.originY - (float)Math.Sin(Elapsed * 3) * 5;
            foreach (var drop in Drops) if (drop.alive) Move(drop, dt, true, .5f);
            Interact(); UpdateEffects(dt);
            Bubbles.RemoveAll(b => !b.alive); Drops.RemoveAll(d => !d.alive); Items.RemoveAll(i => !i.alive);
            Hazards.RemoveAll(h => !h.alive); Stars.RemoveAll(s => !s.alive); Sparks.RemoveAll(s => !s.alive);
            if (Players.All(p => p.Dead)) { Phase = GamePhase.Continue; PhaseTime = 10; return; }
            if (Boss != null ? Boss.hp <= 0 : Enemies.All(e => e.defeated) && Drops.All(d => d.letter)) CompleteStage();
            if (Boss == null && Elapsed >= nextLetterAt && nextLetter < 4)
            { SpawnLetter(80 + nextLetter * 110, 80); nextLetterAt += 12; }
        }
        void UpdateItemSpawns()
        {
            if(itemsSpawned >= 2 || Elapsed < nextItemAt) return;
            var spots = new List<Tile>();
            for(int y=2;y<Stage.layout.Length-1;y++)
            for(int x=1;x<Stage.layout[y].Length-1;x++)
            {
                if(Stage.layout[y][x]!='.' || Stage.layout[y-1][x]!='.' || Stage.layout[y+1][x]!='#') continue;
                var spot = new Actor { x=x*32+16, y=y*32+16 };
                if(Players.Any(p=>!p.Dead && Distance(p,spot)<52) || Items.Any(i=>i.alive && Distance(i,spot)<40)
                    || Enemies.Any(e=>!e.defeated && !e.captured && Distance(e,spot)<36)
                    || (Boss!=null && Boss.hp>0 && Distance(Boss,spot)<90)) continue;
                spots.Add(new Tile{x=x,y=y});
            }
            // Retry when a player moves away, without consuming a spawn or dropping inside a wall.
            if(spots.Count==0) { nextItemAt=Elapsed+.5f; return; }
            var tile=spots[random.Next(spots.Count)];
            var pool=Boss==null?NormalItemPool:BossItemPool;
            var candidates=pool.Where(kind=>kind!="shootingStar" || starsSpawned<2).ToArray();
            string kind=candidates[random.Next(candidates.Length)];
            var item=Create<Drop>(kind+"-item",tile.x*32+16,tile.y*32+16,28,32);
            item.kind=kind;item.power=true;item.originY=item.y;Items.Add(item);
            itemsSpawned++;if(kind=="shootingStar")starsSpawned++;
            nextItemAt=Elapsed+8+(float)random.NextDouble()*4;
            Tell(kind=="trash"?"쓰레기통 등장! 먹으면 유령고래가 나와요!":PowerName(kind)+" 등장!");
            Burst(item.x,item.y,kind=="trash"?0xff5976:0xffe584);
        }
        void UpdatePlayer(Player p, PlayerInput input, float dt)
        {
            if (p.Dead) return;
            p.cooldown = Math.Max(0, p.cooldown - dt); p.invulnerable = Math.Max(0, p.invulnerable - dt);
            p.vx = input.move * (p.powers.speed ? 225 : 150);
            if (input.move != 0) p.facing = input.move < 0 ? -1 : 1;
            p.flip = p.facing < 0; p.jumpHeld = input.jumpHeld;
            if (p.powers.flight) p.vy = input.jumpHeld ? -145 : 38;
            else if (p.grounded && input.jumpPressed) p.vy = p.powers.speed ? -375 : -340;
            Move(p, dt, !p.powers.flight);
            if (input.fire && p.cooldown <= 0) Shoot(p);
        }
        bool Solid(float x, float y)
        {
            int tx = (int)Math.Floor(x / 32), ty = (int)Math.Floor(y / 32);
            return tx < 0 || tx >= 16 || (ty >= 0 && ty < Stage.layout.Length && Stage.layout[ty][tx] == '#');
        }
        void Move(Actor a, float dt, bool gravity, float bounce = 0)
        {
            if (gravity) a.vy = Math.Min(440, a.vy + Gravity * dt);
            a.x = Clamp(a.x + a.vx * dt, 32 + a.halfX, 480 - a.halfX);
            float previousBottom = a.y + a.halfY;
            a.y += a.vy * dt; a.grounded = false;
            // One-way ledges: upward jumps pass through, descending bodies land at the tile top.
            if (a.vy >= 0)
            {
                for (int ty = 1; ty < Stage.layout.Length; ty++)
                {
                    float top = ty * 32;
                    if (previousBottom > top + .5f || a.y + a.halfY < top) continue;
                    int left = Math.Max(1, (int)((a.x - a.halfX + 1) / 32)), right = Math.Min(14, (int)((a.x + a.halfX - 1) / 32));
                    for (int tx = left; tx <= right; tx++) if (Stage.layout[ty][tx] == '#')
                    { a.y = top - a.halfY; a.vy = a.vy > 70 ? -a.vy * bounce : 0; a.grounded = true; break; }
                    if (a.grounded) break;
                }
            }
            if(a.y > Height + 24) { a.y = 46; a.vy = 70; }
            if(a.y < 38) { a.y = 38; a.vy = Math.Max(0,a.vy); }
        }
        Player Nearest(Actor a) => Players.Where(p => !p.Dead).OrderBy(p => Distance(a, p)).FirstOrDefault();
        void UpdateEnemy(Enemy e, float dt)
        {
            if(e.defeated || e.captured) return;
            e.decisionIn -= dt; e.jumpIn -= dt;
            if(e.decisionIn <= 0)
            {
                e.decisionIn = .15f; var p = Nearest(e);
                bool flee = p != null && p.powers.rainbowCharges > 0;
                if(p != null && Distance(e,p) < 240 && (e.behavior == "chase" || flee))
                { float dx = p.x - e.x + p.vx * .22f; if(Math.Abs(dx) > 12) e.direction = dx < 0 ? -1 : 1; if(flee) e.direction *= -1; }
                if(e.x < 45) e.direction = 1; if(e.x > 467) e.direction = -1;
                if(e.grounded && !Solid(e.x + e.direction * 23, e.y + e.halfY + 8) && !(p != null && e.behavior == "chase" && p.y > e.y + 40 && !flee)) e.direction *= -1;
                bool threat = Bubbles.Any(b => b.alive && b.enemy == null && b.age < b.driftAt && Distance(e,b) < 100);
                bool climb = p != null && e.behavior == "chase" && !flee && p.y < e.y - 45 && Math.Abs(p.x - e.x) < 100;
                if(e.grounded && e.jumpIn <= 0 && (threat || climb)) { e.vy = -310; e.jumpIn = 1.1f; }
            }
            e.vx = e.direction * (e.enraged || TimeLeft <= Stage.rules.enrageAtSecondsRemaining ? 104 + StageIndex * 4 : 55 + StageIndex * 4);
            e.flip = e.direction < 0; Move(e,dt,true);
        }
        public Bubble Shoot(Player p)
        {
            p.cooldown = p.powers.element == "water" ? .14f : .3f;
            var b = Create<Bubble>(p.powers.element == null ? "bubble" : "bubble-" + p.powers.element, p.x + p.facing * 18, p.y - 2);
            b.owner = p.index; b.element = p.powers.element; b.rainbow = p.powers.rainbow;
            b.vx = p.facing * (b.element == "lightning" ? 330 : b.element == "fire" ? 230 : 165); b.vy = -8;
            b.driftAt = b.element == "lightning" ? .9f : b.element == "fire" ? .7f : .43f;
            Bubbles.Add(b); if(p.powers.star) ShootStar(p); return b;
        }
        void UpdateBubble(Bubble b, float dt)
        {
            if(!b.alive) return; b.age += dt;
            if(b.age >= b.driftAt)
            {
                float wx = 0, wy = -1;
                foreach(var zone in Stage.airflow ?? new Airflow[0])
                { var r = zone.tileRect; if(b.x >= r.x * 32 && b.x < (r.x + r.width) * 32 && b.y >= r.y * 32 && b.y < (r.y + r.height) * 32) { wx = zone.direction.x; wy = zone.direction.y; break; } }
                b.vx += (wx * 44 - b.vx) * Math.Min(1,dt * 2.7f); b.vy = -48 + wy * 18;
            }
            b.x += b.vx * dt; b.y += b.vy * dt;
            if(b.x < 32) b.vx = Math.Abs(b.vx); if(b.x > 480) b.vx = -Math.Abs(b.vx);
            if(b.enemy != null)
            {
                b.capturedFor += dt; b.enemy.x = b.x; b.enemy.y = b.y;
                if(b.capturedFor > 5) Release(b);
                else if(b.y < 28) { b.y = 400; b.enemy.y = 400; }
            }
            else if(b.age >= b.life || b.y < 28) b.alive = false;
        }
        public void Capture(Bubble b, Enemy e)
        {
            if(e.defeated || e.captured) return;
            e.captured = true; e.art = e.normalArt + "-trapped"; e.width = 18; e.height = 20;
            b.enemy = e; b.capturedFor = 0; b.art = "bubble-green"; b.width = b.height = 34;
            Tell("가둔 거품에 몸으로 톡!");
        }
        public void Release(Bubble b)
        {
            var e = b.enemy; if(e == null) return;
            e.captured = false; e.enraged = true; e.art = e.normalArt; e.width = 30; e.height = 34; e.x = b.x; e.y = b.y; e.vy = 60;
            b.enemy = null; b.alive = false; Tell("귀신이 화가 났어요!");
        }
        public void Pop(Bubble b)
        {
            if(b.enemy == null || b.enemy.defeated) return;
            var e = b.enemy; e.defeated = true; e.captured = false; e.alive = false;
            Reward(e.x,e.y); b.enemy = null; b.alive = false; Tell("성공! +100");
        }
        void Reward(float x,float y)
        {
            Score += 100; string[] kinds = { "strawberry", "banana", "cookie", "apple", "grapes", "cherries" };
            int k = (Score / 100 + StageIndex) % kinds.Length;var d = Create<Drop>(kinds[k],Clamp(x,42,470),Clamp(y,58,374));d.kind=kinds[k];d.value = new[] { 250, 350, 500, 300, 400, 450 }[k];
            d.vx = random.Next(-40,41); d.vy = -180; Drops.Add(d); Burst(x,y,0xffe584);
            if(random.Next(100)<22) SpawnLetter(x,y-12);
        }
        void SpawnLetter(float x,float y)
        {
            if(nextLetter>=4) return;
            string letter = "EXIT"[nextLetter++].ToString();var d=Create<Drop>("letter-"+letter,Clamp(x,42,470),Clamp(y,58,374),30,34);
            d.kind=letter;d.letter=true;d.vy=-220;d.vx=random.Next(-55,56);Drops.Add(d);
        }
        public void GrantPower(Player p,string kind) { p.powers.Grant(kind); }
        void ShootStar(Player p)
        {
            var e=Enemies.Where(a=>!a.defeated && !a.captured).OrderBy(a=>Distance(a,p)).FirstOrDefault();
            if(e==null) return;
            e.defeated=true;var s=Create<Star>("shootingStar-item",p.x,p.y,28,32);
            s.target=e;s.fromX=p.x;s.fromY=p.y;s.targetX=e.x;s.targetY=e.y;Stars.Add(s);Reward(e.x,e.y);
        }
        void Interact()
        {
            foreach(var b in Bubbles)
            {
                if(!b.alive) continue;
                if(b.enemy==null && b.age<b.driftAt)
                {
                    if(Boss!=null && Boss.hp>0 && Touch(b,Boss)) { HitBoss(b.element);b.alive=false;continue; }
                    var e=Enemies.FirstOrDefault(a=>!a.defeated && !a.captured && Touch(a,b));if(e!=null)Capture(b,e);
                }
                foreach(var p in Players)
                {
                    if(p.Dead || b.age<.22f || !Touch(p,b))continue;
                    if(b.enemy!=null)Pop(b);
                    else if(p.vy>35 && p.jumpHeld) { p.vy=-300;b.alive=false; }
                }
            }
            foreach(var p in Players)
            {
                if(p.Dead)continue;
                var contacts=Enemies.Where(e=>!e.captured && !e.defeated && Touch(p,e)).Select(e=>e.id).ToList();
                if(Boss!=null && Boss.hp>0 && Touch(p,Boss))contacts.Add(Boss.id);
                if(Whale!=null && Touch(p,Whale))contacts.Add(Whale.id);
                contacts.AddRange(Hazards.Where(h=>h.alive && h.Active && Touch(p,h)).Select(h=>h.id));
                int before=p.powers.rainbowCharges;
                bool protectedNow=p.powers.Protect(contacts);
                if(protectedNow && p.powers.rainbowCharges<before) { Burst(p.x,p.y,0xffb6ef);if(p.powers.rainbowCharges==0)p.invulnerable=.8f; }
                if(!protectedNow && contacts.Count>0)Hurt(p);
                foreach(var d in Items.Concat(Drops))
                {
                    if(!d.alive || Distance(p,d)>32)continue;d.alive=false;
                    if(d.power)
                    {
                        if(d.kind=="trash") { SpawnWhale();Tell("쓰레기통! 유령고래가 나타났어요!"); }
                        else { GrantPower(p,d.kind);Score+=750;Tell(PowerName(d.kind)+" 획득! 이번 스테이지 동안 유지 +750"); }
                    }
                    else if(d.letter)
                    {
                        ExitLetters.Add(d.kind[0]);Score+=1000;Tell(d.kind+" 획득! +1000");
                        if(ExitLetters.Count==4) { Score+=5000;CompleteStage(); }
                    }
                    else { Score+=d.value;Tell("간식 +"+d.value); }
                    Burst(p.x,p.y,0xffe584);
                }
            }
        }
        public void Hurt(Player p)
        {
            if(p.Dead || p.invulnerable>0)return;
            if(p.powers.shield) { p.powers.shield=false;p.invulnerable=.8f;Tell("방패가 공격을 막았어요!");return; }
            p.lives--;p.powers=new Powers();p.invulnerable=3;p.vx=p.vy=0;
            Burst(p.x,p.y,0xff86b2);p.x=p.spawnX;p.y=p.spawnY;p.alive=!p.Dead;
        }
        public void Continue()
        {
            if(Phase!=GamePhase.Continue)return;
            foreach(var p in Players) { p.lives=Stage.rules.startingLives;p.powers=new Powers();p.alive=true;p.invulnerable=3;p.x=p.spawnX;p.y=p.spawnY;p.vx=p.vy=0; }
            Hazards.Clear();if(Boss!=null)Boss.attackIn=3;Phase=GamePhase.Playing;Tell("CONTINUE! 다시 시작해요");
        }
        public void CompleteStage()
        {
            if(Phase!=GamePhase.Playing || (Boss!=null && Boss.hp>0))return;
            if(StageIndex==Stages.Length-1) { Phase=GamePhase.Victory;return; }
            Phase=GamePhase.StageClear;PhaseTime=1.2f;Tell("STAGE CLEAR!",1.2f);
        }
        void UpdateBoss(float dt)
        {
            if(Boss==null || Boss.hp<=0)return;
            var b=Boss;b.elapsed+=dt;b.hurtFor=Math.Max(0,b.hurtFor-dt);
            bool angry=b.hp<=b.maxHp/2;b.x=256+(float)Math.Sin(b.elapsed*(angry?.8:.55))*125;b.y=254+(float)Math.Sin(b.elapsed*1.2)*34;
            b.flip=Math.Cos(b.elapsed*.55)<0;b.attackIn-=dt;
            if(b.attackIn>0)return;var p=Nearest(b);if(p==null)return;
            if(b.kind=="lightning" && b.attackIndex%2==0)
            {
                AddHazard("lightning",p.x,245,0,0);
                if(angry)AddHazard("lightning",Clamp(p.x+(p.x<256?80:-80),52,460),245,0,0);
            }
            else if(b.kind=="ice")
            {
                // Falling shards across the arena, with gaps and a visible warning before movement.
                int shards=angry?5:3;
                for(int i=0;i<shards;i++)
                {
                    float x=Clamp(p.x+(i-(shards-1)/2f)*64,48,464);
                    AddHazard("ice",x,100,0,angry?170:125);
                }
            }
            else
            {
                double angle=Math.Atan2(p.y-b.y,p.x-b.x);
                float speed=b.kind=="fire"?(angry?175:140):(angry?145:110);
                var spreads=b.kind=="fire" && angry?new[]{-.6f,-.3f,0,.3f,.6f}:new[]{-.3f,0,.3f};
                foreach(float spread in spreads)AddHazard("fire",b.x,b.y+22,(float)Math.Cos(angle+spread)*speed,(float)Math.Sin(angle+spread)*speed);
            }
            b.attackIndex++;b.attackIn=TimeLeft<=0?1.7f:angry?2.2f:3.1f;
        }
        void AddHazard(string kind,float x,float y,float vx,float vy)
        {
            bool bolt=kind=="lightning";var h=Create<Hazard>("boss-"+kind,x,y,22,bolt?332:26);
            h.kind=kind;h.halfX=11;h.halfY=bolt?166:13;h.vx=vx;h.vy=vy;h.delay=bolt?1:.7f;h.life=bolt?.45f:4;Hazards.Add(h);
        }
        public void HitBoss(string element)
        {
            if(Boss==null || Boss.hp<=0)return;
            Boss.hp=Math.Max(0,Boss.hp-BossDamage(element));Boss.hurtFor=.12f;Burst(Boss.x,Boss.y,0xffdf65);
            if(Boss.hp==0) { Boss.alive=false;Hazards.Clear();Score+=5000;Tell("왕을 물리쳤어요! +5000"); }
        }
        void SpawnWhale()
        {
            if(Whale!=null) return;
            // Choose a distant corner so a bad pickup never causes an unavoidable instant hit.
            var corners=new[]{new Actor{x=64,y=72},new Actor{x=448,y=72},new Actor{x=64,y=360},new Actor{x=448,y=360}};
            var living=Players.Where(p=>!p.Dead).ToArray();
            var spawn=corners.OrderByDescending(c=>living.Length==0?0:living.Min(p=>Distance(p,c))).First();
            Whale=Create<Actor>("ghost-whale",spawn.x,spawn.y,48,48);Whale.halfX=18;Whale.halfY=18;
            Burst(Whale.x,Whale.y,0xff5976);
        }
        void UpdateWhale(float dt)
        {
            if(Whale==null)
            {
                if(Boss!=null || TimeLeft>0)return;
                SpawnWhale();Tell("서둘러요! 유령고래가 나타났어요!");
            }
            var p=Nearest(Whale);if(p==null)return;
            float dx=p.x-Whale.x,dy=p.y-Whale.y+(float)Math.Sin(Elapsed*2.7)*28,len=Math.Max(1,(float)Math.Sqrt(dx*dx+dy*dy));
            Whale.x+=dx/len*(105+StageIndex*7)*dt;Whale.y+=dy/len*(105+StageIndex*7)*dt;
            Whale.flip=dx>0;Whale.art=(int)(Elapsed*5)%2==0?"ghost-whale":"ghost-whale-open";
        }
        public void Burst(float x,float y,int color)
        {
            for(int i=0;i<12;i++) { var s=Create<Spark>("spark",x,y,5,5);s.color=color;s.vx=random.Next(-100,101);s.vy=random.Next(-130,30);s.life=s.initialLife=.35f+(float)random.NextDouble()*.3f;Sparks.Add(s); }
        }
        void UpdateEffects(float dt)
        {
            foreach(var s in Stars)
            {
                s.age+=dt;
                if(s.age<.22f) { float t=s.age/.22f;s.x=s.fromX+(s.targetX-s.fromX)*t;s.y=s.fromY+(s.targetY-s.fromY)*t; }
                else { float t=(s.age-.22f)/.55f;s.x=s.targetX+100*t;s.y=s.targetY+(-40-s.targetY)*t;s.target.x=s.x;s.target.y=s.y;if(t>=1){s.alive=false;s.target.alive=false;} }
            }
            foreach(var s in Sparks) { s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy+=160*dt;if(s.life<=0)s.alive=false; }
        }
        public IEnumerable<Actor> Actors()
        {
            foreach(var a in Players)if(a.alive)yield return a;
            foreach(var a in Enemies)if(a.alive)yield return a;
            foreach(var a in Bubbles)if(a.alive)yield return a;
            foreach(var a in Items)if(a.alive)yield return a;
            foreach(var a in Drops)if(a.alive)yield return a;
            foreach(var a in Hazards)if(a.alive)yield return a;
            foreach(var a in Stars)if(a.alive)yield return a;
            foreach(var a in Sparks)if(a.alive)yield return a;
            if(Boss!=null && Boss.alive)yield return Boss;if(Whale!=null)yield return Whale;
        }
    }
}
