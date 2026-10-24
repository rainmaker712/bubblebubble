using System.Collections;
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace BubbleBubble.Tests
{
    public class NativeGameTests
    {
        // Explicit camera rendering also works in batch-mode tests, without WaitForEndOfFrame.
        static void CaptureWorld(string name)
        {
            var camera=Camera.main;var previous=RenderTexture.active;var target=camera.targetTexture;var rect=camera.rect;
            var rt=new RenderTexture(1024,896,24);var image=new Texture2D(1024,896,TextureFormat.RGB24,false);
            try
            {
                camera.rect=new Rect(0,0,1,1);camera.targetTexture=rt;camera.Render();RenderTexture.active=rt;
                image.ReadPixels(new Rect(0,0,1024,896),0,0);image.Apply();
                File.WriteAllBytes(Path.GetFullPath("TestResults/"+name),image.EncodeToPNG());
            }
            finally
            {
                camera.targetTexture=target;camera.rect=rect;RenderTexture.active=previous;
                Object.DestroyImmediate(image);Object.DestroyImmediate(rt);
            }
        }
        [UnityTest]
        public IEnumerator NativeSceneRendersAllStagesAndPowers()
        {
            yield return SceneManager.LoadSceneAsync("Main");
            yield return null;
            var app=Object.FindFirstObjectByType<GameApp>();Assert.IsNotNull(app);
            Assert.AreEqual(GamePhase.Menu,app.World.Phase);
            Assert.IsNotNull(Resources.Load<Font>("Fonts/NotoSansKR"));
            Assert.IsTrue(Resources.Load<Font>("Fonts/NotoSansKR").HasCharacter('낙'));
            foreach(var key in new[]{"ghost-whale","ghost-whale-open","trash-item","boss-king","boss-ember-king","boss-frost-king","boss-ice"})
                Assert.IsNotNull(Resources.Load<Sprite>("Art/"+key),key);
            Assert.IsTrue(Resources.Load<Shader>("Rainbow").isSupported);
            Directory.CreateDirectory("TestResults");
            CaptureWorld("unity-menu-world.png");
            for(int i=0;i<5;i++)yield return null;
            app.Begin(2);
            for(int i=0;i<5;i++)yield return null;
            Assert.IsNull(app.World.Boss);
            Assert.Greater(Object.FindObjectsByType<SpriteRenderer>(FindObjectsSortMode.None).Length,50);
            CaptureWorld("unity-first-stage-world.png");
            for(int i=0;i<5;i++)yield return null;
            for(int stage=1;stage<9;stage++)
            {
                app.World.LoadStage(stage);var p=app.World.Players[0];
                app.World.GrantPower(p,"rainbow");app.World.GrantPower(p,"fire");app.World.GrantPower(p,"shootingStar");
                app.World.Shoot(p);app.World.Shoot(p);
                for(int i=0;i<5;i++)yield return null;
                Assert.AreEqual(stage,app.World.StageIndex);
                Assert.AreEqual(2,app.World.Enemies.Count(e=>e.defeated));
                if(stage==1)CaptureWorld("unity-rainbow-star-world.png");
            }
            app.World.LoadStage(9);
            Assert.AreEqual(36,app.World.Boss.maxHp);
            // Random selection is covered by seeded EditMode tests; exercise each rendering fixture deterministically here.
            foreach(var kind in new[]{"lightning","fire","ice"})
            {
                app.World.LoadStage(9);var boss=app.World.Boss;boss.kind=kind;
                boss.art=kind=="lightning"?"boss-king":kind=="fire"?"boss-ember-king":"boss-frost-king";
                boss.attackIn=0;
                for(int frame=0;frame<5;frame++)yield return null;
                Assert.IsTrue(app.World.Hazards.Any(h=>h.kind==kind));
                CaptureWorld("unity-boss-"+kind+".png");
            }
            app.World.LoadStage(1);var victim=app.World.Players[0];
            app.World.Items.Add(new Drop{kind="trash",power=true,art="trash-item",x=victim.x,y=victim.y,originY=victim.y});
            for(int frame=0;frame<5;frame++)yield return null;
            Assert.IsNotNull(app.World.Whale);Assert.IsTrue(app.World.Danger);
            CaptureWorld("unity-skel-monsta.png");
            app.World.LoadStage(1);var player=app.World.Players[0];float start=player.x;
            app.World.Tick(1f/60,new[]{new PlayerInput{move=1,fire=true},new PlayerInput()});
            Assert.Greater(player.x,start);Assert.IsTrue(app.World.Bubbles.Count>0);
            app.World.TogglePause();float time=app.World.TimeLeft;
            yield return null;Assert.AreEqual(time,app.World.TimeLeft);
            LogAssert.NoUnexpectedReceived();
        }
    }
}
