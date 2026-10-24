using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace BubbleBubble
{
    [DisallowMultipleComponent]
    public sealed class GameApp : MonoBehaviour
    {
        public GameWorld World { get; private set; }
        readonly Dictionary<int, SpriteRenderer> views = new Dictionary<int, SpriteRenderer>();
        readonly Dictionary<string, Sprite> sprites = new Dictionary<string, Sprite>();
        readonly List<GameObject> scenery = new List<GameObject>();
        readonly PlayerInput[] inputs = new PlayerInput[2];
        Camera gameCamera;
        Material rainbowMaterial, defaultMaterial;
        MaterialPropertyBlock rainbowProperties;
        MoonlightAudio music;
        Font font;
        GUIStyle text, title, small, button;
        Texture2D white;
        float accumulator;
        int drawnStage = -1;
        bool stylesReady;
        static readonly Color Cream = new Color(1,.96f,.75f), Pink = new Color(1,.48f,.68f);

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Bootstrap()
        {
            if (FindFirstObjectByType<GameApp>() == null) new GameObject("BubbleBubble").AddComponent<GameApp>();
        }
        void Awake()
        {
            Application.targetFrameRate = 60;
            var stages = Enumerable.Range(1,10).Select(i => {
                var asset = Resources.Load<TextAsset>($"Stages/stage-{i:00}");
                if(asset == null) throw new InvalidOperationException($"Missing stage {i}");
                return JsonUtility.FromJson<StageData>(asset.text);
            }).ToArray();
            World = new GameWorld(stages, Environment.TickCount);
            font = Resources.Load<Font>("Fonts/NotoSansKR");
            white = Texture2D.whiteTexture;
            var cameraObject = new GameObject("Game Camera"); cameraObject.transform.SetParent(transform);
            gameCamera = cameraObject.AddComponent<Camera>(); gameCamera.tag = "MainCamera";
            gameCamera.orthographic = true;gameCamera.orthographicSize = 224;gameCamera.nearClipPlane = .1f;gameCamera.farClipPlane = 100;
            gameCamera.transform.position = new Vector3(256,-224,-10);gameCamera.clearFlags = CameraClearFlags.SolidColor;
            cameraObject.AddComponent<AudioListener>();
            defaultMaterial = new Material(Shader.Find("Sprites/Default"));
            rainbowMaterial = new Material(Resources.Load<Shader>("Rainbow")); rainbowProperties = new MaterialPropertyBlock();
            music = gameObject.AddComponent<MoonlightAudio>();
            DrawStage();
        }
        void Update()
        {
            float desired = 512f/448f, aspect = Screen.width/(float)Math.Max(1,Screen.height);
            gameCamera.rect = aspect > desired ? new Rect((1-desired/aspect)/2,0,desired/aspect,1) : new Rect(0,(1-aspect/desired)/2,1,aspect/desired);
            if(Input.GetKeyDown(KeyCode.M))music.Toggle();
            if(Input.GetKeyDown(KeyCode.Escape))World.TogglePause();
            if(World.Phase == GamePhase.Continue && Input.GetKeyDown(KeyCode.C))World.Continue();
            if(World.Phase == GamePhase.Menu || World.Phase == GamePhase.Victory || World.Phase == GamePhase.GameOver)
            {
                if(Input.GetKeyDown(KeyCode.Alpha1) || Input.GetKeyDown(KeyCode.Return))Begin(1);
                if(Input.GetKeyDown(KeyCode.Alpha2))Begin(2);
            }
            ReadInput(0,KeyCode.A,KeyCode.D,KeyCode.W,KeyCode.F);
            ReadInput(1,KeyCode.LeftArrow,KeyCode.RightArrow,KeyCode.UpArrow,KeyCode.Period);
            accumulator += Math.Min(Time.unscaledDeltaTime,.1f);
            while(accumulator >= 1f/60)
            {
                World.Tick(1f/60,inputs); accumulator -= 1f/60;
                inputs[0].jumpPressed = inputs[1].jumpPressed = false;
            }
            if(drawnStage != World.StageIndex)DrawStage();
            SyncViews();
            music.SetState(World.Phase != GamePhase.Menu,World.Danger,World.Phase == GamePhase.Paused);
        }
        void ReadInput(int i,KeyCode left,KeyCode right,KeyCode jump,KeyCode fire)
        {
            inputs[i].move = (Input.GetKey(right)?1:0)-(Input.GetKey(left)?1:0);
            inputs[i].jumpPressed |= Input.GetKeyDown(jump);inputs[i].jumpHeld = Input.GetKey(jump);inputs[i].fire = Input.GetKey(fire);
        }
        public void Begin(int count) { World.Start(count);DrawStage();accumulator=0; }
        void OnApplicationFocus(bool focus) { if(!focus && World != null && World.Phase == GamePhase.Playing)World.TogglePause(); }
        Sprite Art(string name)
        {
            if(!sprites.TryGetValue(name,out var sprite))
            {
                sprite=Resources.Load<Sprite>("Art/"+name);
                if(sprite==null)throw new InvalidOperationException("Missing sprite: "+name);
                sprites.Add(name,sprite);
            }
            return sprite;
        }
        SpriteRenderer MakeSprite(string name, string art, float x, float y, float width, float height, int order)
        {
            var obj=new GameObject(name);obj.transform.SetParent(transform);
            var renderer=obj.AddComponent<SpriteRenderer>();renderer.sharedMaterial=defaultMaterial;renderer.sprite=Art(art);renderer.sortingOrder=order;
            SetPose(renderer,x,y,width,height);return renderer;
        }
        static void SetPose(SpriteRenderer r,float x,float y,float w,float h)
        {
            r.transform.localPosition=new Vector3(x,-y,0);
            r.transform.localScale=new Vector3(w/r.sprite.bounds.size.x,h/r.sprite.bounds.size.y,1);
        }
        void DrawStage()
        {
            foreach(var obj in scenery)Destroy(obj);scenery.Clear();drawnStage=World.StageIndex;
            ColorUtility.TryParseHtmlString(World.Stage.theme.palette[0],out var background);gameCamera.backgroundColor=background;
            var layout=World.Stage.layout;
            for(int y=0;y<layout.Length;y++)for(int x=0;x<layout[y].Length;x++)
                if(layout[y][x]=='#')scenery.Add(MakeSprite("Platform "+x+","+y,"platform-s"+(drawnStage+1),x*32+16,y*32+16,32,32,-5).gameObject);
            var rng=new System.Random(100+drawnStage);
            for(int i=0;i<32;i++)
            {
                var star=MakeSprite("Backdrop sparkle","spark",rng.Next(35,477),rng.Next(38,410),3,3,-10);star.color=new Color(.8f,.75f,1,.2f);scenery.Add(star.gameObject);
            }
        }
        void SyncViews()
        {
            var present=new HashSet<int>();rainbowProperties.SetFloat("_HueTime",World.Elapsed);
            foreach(var actor in World.Actors())
            {
                present.Add(actor.id);
                if(!views.TryGetValue(actor.id,out var r)) { r=MakeSprite(actor.GetType().Name+" "+actor.id,actor.art,actor.x,actor.y,actor.width,actor.height,10);views.Add(actor.id,r); }
                r.sprite=Art(actor.art);SetPose(r,actor.x,actor.y,actor.width,actor.height);r.flipX=actor.flip;r.color=Color.white;
                bool rainbow=false;r.sortingOrder=10;
                if(actor is Player p)
                {
                    r.sortingOrder=20;rainbow=p.powers.rainbow;
                    if(p.invulnerable>0 && (int)(p.invulnerable*12)%2==0)r.color=new Color(1,1,1,.3f);
                    else if(!rainbow)r.color=p.powers.shield?new Color(.65f,1,.8f):p.powers.speed?Cream:Color.white;
                }
                if(actor is Bubble b) { rainbow=b.rainbow;r.sortingOrder=15;float pulse=1+(float)Math.Sin(World.Elapsed*7)*.06f;SetPose(r,b.x,b.y,b.width*pulse,b.height*pulse); }
                if(actor is Enemy e)r.sortingOrder=e.captured?16:18;
                if(actor is Drop drop) { r.sortingOrder=24;if(drop.kind=="trash")r.color=new Color(1,.65f+.25f*Mathf.Sin(World.Elapsed*6),.7f); }
                if(actor is Boss boss) { r.sortingOrder=19;r.color=boss.hurtFor>0?Pink:Color.white; }
                if(actor is Hazard hazard && !hazard.Active)r.color=new Color(1,.6f,.3f,.16f+.2f*Mathf.Abs(Mathf.Sin(World.Elapsed*12)));
                if(actor is Star s) { r.sortingOrder=35;r.transform.localRotation=Quaternion.Euler(0,0,s.age*720); }
                if(actor is Spark spark) { r.sortingOrder=36;r.color=new Color(((spark.color>>16)&255)/255f,((spark.color>>8)&255)/255f,(spark.color&255)/255f,spark.life/spark.initialLife); }
                r.sharedMaterial=rainbow?rainbowMaterial:defaultMaterial;r.SetPropertyBlock(rainbow?rainbowProperties:null);
            }
            foreach(int id in views.Keys.Where(id=>!present.Contains(id)).ToArray()) { Destroy(views[id].gameObject);views.Remove(id); }
        }
        void Styles()
        {
            if(stylesReady)return;stylesReady=true;
            text=new GUIStyle(GUI.skin.label){font=font,fontSize=12,alignment=TextAnchor.MiddleLeft};text.normal.textColor=Cream;
            small=new GUIStyle(text){fontSize=9};
            title=new GUIStyle(text){fontSize=28,alignment=TextAnchor.MiddleCenter,fontStyle=FontStyle.Bold};
            button=new GUIStyle(GUI.skin.button){font=font,fontSize=14,fontStyle=FontStyle.Bold};
            button.normal.textColor=Cream;button.hover.textColor=Color.white;
        }
        void Box(Rect rect,Color color) { var previous=GUI.color;GUI.color=color;GUI.DrawTexture(rect,white);GUI.color=previous; }
        void Label(float x,float y,float w,float h,string value,GUIStyle style=null) { GUI.Label(new Rect(x,y,w,h),value,style??text); }
        void Center(float y,string value,int size=14)
        { var style=new GUIStyle(text){alignment=TextAnchor.MiddleCenter,fontSize=size};Label(30,y,452,30,value,style); }
        void OnGUI()
        {
            if(World==null)return;Styles();
            float scale=Math.Min(Screen.width/512f,Screen.height/448f);var before=GUI.matrix;
            GUI.matrix=Matrix4x4.TRS(new Vector3((Screen.width-512*scale)/2,(Screen.height-448*scale)/2,0),Quaternion.identity,new Vector3(scale,scale,1));
            Box(new Rect(0,0,512,32),new Color(.05f,.04f,.11f,.98f));
            Label(12,3,188,24,$"SCORE {World.Score:000000}");
            Label(205,3,130,24,$"STAGE {World.StageIndex+1:00}");
            Label(343,3,100,24,$"TIME {Math.Ceiling(World.TimeLeft):000}");
            if(GUI.Button(new Rect(452,5,49,22),music.Enabled?"♪ ON":"♪ OFF",small))music.Toggle();
            if(World.Phase!=GamePhase.Menu)
            {
                Label(12,417,220,24,string.Join("   ",World.Players.Select(p=>$"{p.index+1}P ♥ {p.lives}")));
                Label(255,417,140,24,"EXIT  "+string.Join(" ","EXIT".Select(c=>World.ExitLetters.Contains(c)?c.ToString():"·")));
                if(GUI.Button(new Rect(427,420,74,22),World.Phase==GamePhase.Paused?"계속 Esc":"정지 Esc",small))World.TogglePause();
                foreach(var p in World.Players.Where(p=>!p.Dead))
                {
                    if(p.powers.rainbowCharges>0)Label(p.x-36,p.y-40,90,18,$"무지개 {p.powers.rainbowCharges}/10",small);
                    var powerNames=new List<string>();
                    if(p.powers.element!=null)powerNames.Add(GameRules.PowerName(p.powers.element));
                    if(p.powers.speed)powerNames.Add("신발");if(p.powers.flight)powerNames.Add("구름");if(p.powers.shield)powerNames.Add("방패");if(p.powers.rainbow)powerNames.Add("무지개");if(p.powers.star)powerNames.Add("별똥별");
                    Label(38,76+p.index*13,430,18,$"{p.index+1}P "+string.Join(" · ",powerNames),small);
                }
                foreach(var item in World.Items)
                {
                    var itemStyle=new GUIStyle(small);if(item.kind=="trash")itemStyle.normal.textColor=Pink;
                    Label(item.x-45,item.y-34,110,20,GameRules.PowerName(item.kind),itemStyle);
                }
                foreach(var hazard in World.Hazards.Where(h=>!h.Active))Label(hazard.x-25,hazard.kind=="lightning"?388:hazard.y-28,70,20,"주의!",small);
                if(World.Boss!=null && World.Boss.hp>0)
                {
                    Center(33,$"{World.Boss.displayName}  {World.Boss.hp}/{World.Boss.maxHp}",11);
                    Box(new Rect(146,63,220,6),new Color(.2f,.08f,.15f));Box(new Rect(146,63,220f*World.Boss.hp/World.Boss.maxHp,6),Pink);
                }
                if(World.NoticeTime>0) { Box(new Rect(38,371,436,30),new Color(.08f,.06f,.16f,.9f));Center(371,World.Notice,12); }
            }
            if(World.Phase==GamePhase.Menu || World.Phase==GamePhase.Victory || World.Phase==GamePhase.GameOver)Menu();
            else if(World.Phase==GamePhase.Paused)
            {
                Panel();Center(135,"잠깐 쉬어가기",24);Center(180,"Esc를 누르면 계속합니다",12);
                if(GUI.Button(new Rect(156,226,200,38),"계속하기",button))World.TogglePause();
                if(GUI.Button(new Rect(156,274,200,34),"타이틀로",button))World.ReturnToMenu();
            }
            else if(World.Phase==GamePhase.Continue)
            {
                Panel();Center(145,"CONTINUE?",26);Center(194,$"{Math.Ceiling(World.PhaseTime)}초 안에 C 키를 눌러주세요",14);
                if(GUI.Button(new Rect(146,250,220,40),"C · 이어하기",button))World.Continue();
            }
            else if(World.Phase==GamePhase.StageClear)Center(185,"STAGE CLEAR!",28);
            GUI.matrix=before;
        }
        void Panel() { Box(new Rect(28,100,456,245),new Color(.055f,.04f,.13f,.96f)); }
        void Menu()
        {
            Box(new Rect(28,54,456,350),new Color(.055f,.04f,.13f,.97f));
            Center(69,"BUBBLE BUBBLE",30);
            Center(109,World.Phase==GamePhase.Victory?"모든 스테이지 클리어!":World.Phase==GamePhase.GameOver?"다시 도전해 볼까요?":"낙콩 & 무닝의 달빛 모험",15);
            if(World.Phase!=GamePhase.Menu)Center(140,$"최종 점수 {World.Score:N0}",13);
            DrawPortrait("nakkong",166,157);DrawPortrait("muning",294,157);
            if(GUI.Button(new Rect(64,224,182,42),"1 · 낙콩 혼자 하기",button))Begin(1);
            if(GUI.Button(new Rect(266,224,182,42),"2 · 둘이서 하기",button))Begin(2);
            Center(276,"1P  A / D 이동 · W 점프 · F 거품",12);
            Center(300,"2P  ← / → 이동 · ↑ 점프 · . 거품",12);
            Center(332,"아이템은 랜덤 등장 · 효과는 이번 스테이지까지",10);
            Center(353,"쓰레기통은 피하세요! · 마지막 10탄은 랜덤 보스",10);
            Center(375,"Esc 일시정지 · C 이어하기 · M 음악",10);
        }
        void DrawPortrait(string art,float x,float y) { GUI.DrawTexture(new Rect(x-23,y,46,49),Art(art).texture,ScaleMode.ScaleToFit,true); }
        void OnDestroy() { if(rainbowMaterial!=null)Destroy(rainbowMaterial);if(defaultMaterial!=null)Destroy(defaultMaterial); }
    }
}
