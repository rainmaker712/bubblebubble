using System.Linq;
using NUnit.Framework;
using UnityEngine;

namespace BubbleBubble.Tests
{
    public class GameWorldTests
    {
        static StageData[] Stages() => Enumerable.Range(1, 10)
            .Select(i => JsonUtility.FromJson<StageData>(Resources.Load<TextAsset>($"Stages/stage-{i:00}").text)).ToArray();
        static GameWorld Game(int count = 1, int stage = 1)
        {
            var game = new GameWorld(Stages(), 42);
            game.Start(count);
            game.LoadStage(stage);
            return game;
        }
        [Test] public void TenStagesHaveArtCharactersAndCappedPowerups()
        {
            var stages = Stages();
            Assert.AreEqual(10, stages.Length);
            foreach (var stage in stages)
            {
                Assert.AreEqual(14, stage.layout.Length);
                Assert.IsTrue(stage.layout.All(row => row.Length == 16));
                Assert.LessOrEqual(stage.items.Length, 2);
                Assert.LessOrEqual(stage.items.Count(i => i.kind == "shootingStar"), 2);
                Assert.AreEqual("nakkong", stage.playerSpawns[0].character);
                Assert.AreEqual("muning", stage.playerSpawns[1].character);
            }
            Assert.IsTrue(stages.All(s => s.items.Length == 0), "Powerups are now scheduled at runtime.");
        }
        [Test] public void PowersExpireOnStageChangeAndWhenOneLifeIsLost()
        {
            var g = Game(); var p = g.Players[0];
            foreach (var kind in new[] { "fire", "shoes", "cloud", "rainbow", "shootingStar" }) g.GrantPower(p, kind);
            p.powers.rainbowCharges = 0;
            g.LoadStage(2);
            p = g.Players[0];
            Assert.IsNull(p.powers.element);
            Assert.IsFalse(p.powers.rainbow || p.powers.star || p.powers.flight || p.powers.speed);
            Assert.AreEqual(3,p.lives);
            foreach (var kind in new[] { "fire", "shoes", "cloud", "rainbow", "shootingStar" }) g.GrantPower(p, kind);
            g.Hurt(p);
            Assert.AreEqual(2, p.lives);
            Assert.IsFalse(p.powers.rainbow || p.powers.star || p.powers.flight || p.powers.speed);
            Assert.IsNull(p.powers.element);
        }
        [Test] public void RainbowPersistsAfterTenContactsAndStacksWithElement()
        {
            var g = Game(); var p = g.Players[0];
            g.GrantPower(p, "rainbow"); g.GrantPower(p, "fire");
            for (int i = 0; i < 10; i++)
            {
                Assert.IsTrue(p.powers.Protect(new[] { 12 }));
                Assert.IsTrue(p.powers.Protect(new[] { 12 }) || i == 9);
                p.powers.Protect(new int[0]);
            }
            Assert.AreEqual(0, p.powers.rainbowCharges);
            var b = g.Shoot(p);
            Assert.IsTrue(b.rainbow);
            Assert.AreEqual("fire", b.element);
        }
        [Test] public void StarTakesExactlyOneEnemyPerShotAndNeverDuplicates()
        {
            var g = Game(2); var p = g.Players[0];g.GrantPower(p, "shootingStar");
            g.Shoot(p); Assert.AreEqual(1, g.Enemies.Count(e => e.defeated));
            g.Shoot(p); Assert.AreEqual(2, g.Enemies.Count(e => e.defeated));
            Assert.AreEqual(2, g.Stars.Count);
            Assert.IsFalse(g.Players[1].powers.star);
            foreach (var e in g.Enemies) e.defeated = true;
            Assert.DoesNotThrow(() => g.Shoot(p));
        }
        [Test] public void ShieldAbsorbsOneHitWithoutRemovingOtherPowers()
        {
            var g = Game();var p = g.Players[0];g.GrantPower(p, "shield");g.GrantPower(p, "cloud");
            g.Hurt(p);Assert.AreEqual(3, p.lives);Assert.IsTrue(p.powers.flight);Assert.IsFalse(p.powers.shield);
            p.invulnerable = 0;g.Hurt(p);Assert.AreEqual(2, p.lives);Assert.IsFalse(p.powers.flight);
        }
        [Test] public void BossUsesElementDamageAndBlocksExitUntilDefeated()
        {
            var g = Game(2, 9);Assert.AreEqual(36, g.Boss.hp);
            g.CompleteStage();Assert.AreEqual(GamePhase.Playing, g.Phase);
            Assert.AreEqual(1, GameRules.BossDamage(null));
            Assert.AreEqual(2, GameRules.BossDamage("lightning"));
            Assert.AreEqual(3, GameRules.BossDamage("fire"));
            g.HitBoss("fire");Assert.AreEqual(33, g.Boss.hp);
            while (g.Boss.hp > 0) g.HitBoss("fire");
            g.CompleteStage();Assert.AreEqual(GamePhase.Victory, g.Phase);
        }
        [Test] public void PauseFreezesSimulationAndContinueKeepsBossDamage()
        {
            var g = Game(1, 9);g.HitBoss("fire");g.TogglePause();
            float left = g.TimeLeft;g.Tick(1, new PlayerInput[2]);Assert.AreEqual(left, g.TimeLeft);
            g.TogglePause();var p = g.Players[0];
            for(int i=0;i<3;i++){p.invulnerable=0;g.Hurt(p);}
            g.Tick(.01f,new PlayerInput[2]);Assert.AreEqual(GamePhase.Continue, g.Phase);
            g.Continue();Assert.AreEqual(21,g.Boss.hp);Assert.AreEqual(3,p.lives);
            Assert.AreEqual(0,g.Hazards.Count);
        }
        [Test] public void CaptureReleaseAndPopHaveDifferentOutcomes()
        {
            var g=Game();var p=g.Players[0];var e=g.Enemies[0];var b=g.Shoot(p);
            g.Capture(b,e);Assert.IsTrue(e.captured);g.Release(b);Assert.IsFalse(e.captured);Assert.IsTrue(e.enraged);
            b=g.Shoot(p);g.Capture(b,e);g.Pop(b);Assert.IsTrue(e.defeated);Assert.AreEqual(1,g.Drops.Count(d=>!d.letter));
        }
        [Test] public void NewSessionResetsScorePowersAndStage()
        {
            var g=Game();g.GrantPower(g.Players[0],"shootingStar");g.Start(2);
            Assert.AreEqual(0,g.Score);Assert.AreEqual(0,g.StageIndex);
            Assert.IsTrue(g.Players.All(p=>!p.powers.star));Assert.AreEqual(2,g.Players.Count);
        }
        static void SafeAdvance(GameWorld g,float seconds)
        {
            foreach(var e in g.Enemies)e.captured=true;
            foreach(var p in g.Players)p.invulnerable=10000;
            for(float t=0;t<seconds;t+=.04f)g.Tick(.04f,new PlayerInput[2]);
        }
        [Test] public void OnlyFinalStageHasBossAndFirstStageHasRegularEnemies()
        {
            var stages=Stages();
            Assert.IsTrue(stages.Take(9).All(s=>s.boss==null || s.boss.hp==0));
            Assert.Greater(stages[0].enemies.Length,0);
            Assert.Greater(stages[9].boss.hp,0);
            Assert.AreEqual(0,stages[9].enemies.Length);
            var g=Game(1,0);Assert.IsNull(g.Boss);
            foreach(var e in g.Enemies){e.defeated=true;e.alive=false;}
            g.Tick(.04f,new PlayerInput[2]);Assert.AreEqual(GamePhase.StageClear,g.Phase);
            g.Tick(1.3f,new PlayerInput[2]);Assert.AreEqual(1,g.StageIndex);
        }
        [Test] public void ItemsAppearDuringPlayRatherThanAtStageLoadAndPauseFreezesSpawning()
        {
            var g=Game();Assert.AreEqual(0,g.Items.Count);
            SafeAdvance(g,3);Assert.AreEqual(0,g.Items.Count);
            g.TogglePause();SafeAdvance(g,30);Assert.AreEqual(0,g.Items.Count);g.TogglePause();
            SafeAdvance(g,22);Assert.AreEqual(2,g.Items.Count);
            SafeAdvance(g,15);Assert.AreEqual(2,g.Items.Count);
            Assert.LessOrEqual(g.Items.Count(i=>i.kind=="shootingStar"),2);
            foreach(var item in g.Items)
            {
                int x=(int)(item.x/32),y=(int)(item.originY/32);
                Assert.AreEqual('.',g.Stage.layout[y][x]);
                Assert.AreEqual('#',g.Stage.layout[y+1][x]);
            }
        }
        [Test] public void ItemRollsVaryAcrossSeedsAndIncludeTrashAndStars()
        {
            var kinds=new System.Collections.Generic.HashSet<string>();
            var positions=new System.Collections.Generic.HashSet<string>();
            for(int seed=0;seed<60;seed++)
            {
                var g=new GameWorld(Stages(),seed);g.Start(1);SafeAdvance(g,25);
                foreach(var item in g.Items){kinds.Add(item.kind);positions.Add(item.x+","+item.originY);}
            }
            Assert.IsTrue(kinds.Contains("trash"));Assert.IsTrue(kinds.Contains("shootingStar"));
            Assert.Greater(kinds.Count,4);Assert.Greater(positions.Count,4);
        }
        [Test] public void TrashSummonsOneWhaleImmediatelyWithoutScoreOrTimerLoss()
        {
            foreach(int stage in new[]{0,9})
            {
                var g=Game(2,stage);var p=g.Players[0];int score=g.Score;
                g.Items.Add(new Drop{kind="trash",power=true,x=p.x,y=p.y,originY=p.y});
                g.Tick(.01f,new PlayerInput[2]);
                Assert.IsNotNull(g.Whale);Assert.IsTrue(g.Danger);Assert.Greater(g.TimeLeft,0);
                Assert.AreEqual(score,g.Score);int id=g.Whale.id;float x=g.Whale.x,y=g.Whale.y;
                g.Items.Add(new Drop{kind="trash",power=true,x=p.x,y=p.y,originY=p.y});g.Tick(.01f,new PlayerInput[2]);
                Assert.AreEqual(id,g.Whale.id);Assert.IsTrue(g.Whale.x!=x || g.Whale.y!=y);
                g.LoadStage(1);Assert.IsNull(g.Whale);Assert.IsFalse(g.Danger);
            }
        }
        [Test] public void TimeoutStillSpawnsWhaleAndContinueKeepsIt()
        {
            var g=Game();SafeAdvance(g,g.TimeLeft+1);Assert.IsNotNull(g.Whale);
            var p=g.Players[0];for(int i=0;i<3;i++){p.invulnerable=0;g.Hurt(p);}
            g.Tick(.01f,new PlayerInput[2]);g.Continue();Assert.IsNotNull(g.Whale);
        }
        [Test] public void FinalBossVariesAcrossRunsButContinueKeepsTheSelectedBoss()
        {
            var arts=new System.Collections.Generic.HashSet<string>();
            for(int seed=0;seed<20;seed++)
            {
                var g=new GameWorld(Stages(),seed);g.Start(1);g.LoadStage(9);arts.Add(g.Boss.art);
                var boss=g.Boss;g.HitBoss("fire");var p=g.Players[0];
                for(int i=0;i<3;i++){p.invulnerable=0;g.Hurt(p);}g.Tick(.01f,new PlayerInput[2]);g.Continue();
                Assert.AreSame(boss,g.Boss);Assert.AreEqual(21,g.Boss.hp);
            }
            Assert.AreEqual(3,arts.Count);
        }
        [Test] public void CollectedItemsAndContinueDoNotResetStageSpawnBudget()
        {
            var g=Game();SafeAdvance(g,25);Assert.AreEqual(2,g.Items.Count);
            g.Items.Clear();SafeAdvance(g,10);Assert.AreEqual(0,g.Items.Count);
            var p=g.Players[0];for(int i=0;i<3;i++){p.invulnerable=0;g.Hurt(p);}
            g.Tick(.01f,new PlayerInput[2]);g.Continue();SafeAdvance(g,25);Assert.AreEqual(0,g.Items.Count);
            g.LoadStage(2);SafeAdvance(g,25);Assert.AreEqual(2,g.Items.Count);
        }
        [Test] public void BossVariantsHaveDifferentEnragedAttacksAndWarningsDoNotHurt()
        {
            foreach(var kind in new[]{"lightning","fire","ice"})
            {
                var g=Game(1,9);g.Boss.kind=kind;g.Boss.hp=12;g.Boss.attackIn=0;
                g.Tick(.01f,new PlayerInput[2]);
                Assert.AreEqual(kind=="lightning"?2:5,g.Hazards.Count);
                Assert.IsTrue(g.Hazards.All(h=>h.kind==kind && !h.Active));
                var p=g.Players[0];var h=g.Hazards[0];h.x=64;h.y=300;p.x=h.x;p.y=h.y;
                g.Tick(.01f,new PlayerInput[2]);Assert.AreEqual(3,p.lives);
                foreach(var hazard in g.Hazards)hazard.delay=0;
                p.x=h.x;p.y=h.y;g.Tick(.01f,new PlayerInput[2]);Assert.AreEqual(2,p.lives);
            }
        }
    }
}
