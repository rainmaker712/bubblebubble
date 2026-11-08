using UnityEngine;

namespace BubbleBubble
{
    public sealed partial class GameApp
    {
        float storyAnimationTime;
        public bool AutoStoryAdvance { get; set; } = true;
        float StoryDuration => storyVoice.clip != null ? Mathf.Max(1,storyVoice.clip.length) : 12;
        public float StoryProgress => Mathf.Clamp01(storyAnimationTime / StoryDuration);

        void UpdateStoryAnimation()
        {
            if(!showingStory)return;
            storyAnimationTime+=Time.unscaledDeltaTime;
            if(AutoStoryAdvance && storyPage<StoryPageCount-1 &&
                storyAnimationTime>=StoryDuration+.8f && !storyVoice.isPlaying)AdvanceStory();
        }

        static float Cue(float progress,float start,float end)
        { return Mathf.SmoothStep(0,1,Mathf.InverseLerp(start,end,progress)); }

        void StorySprite(string art,float x,float y,float size=36,float opacity=1)
        {
            var previous=GUI.color;
            GUI.color=new Color(previous.r,previous.g,previous.b,previous.a*opacity);
            GUI.DrawTexture(new Rect(x-size/2,y-size/2,size,size),Art(art).texture,ScaleMode.ScaleToFit,true);
            GUI.color=previous;
        }

        void StoryFriends(float x,float y,float walk=0,float opacity=1)
        {
            float bounce=Mathf.Abs(Mathf.Sin(storyAnimationTime*7))*walk;
            StorySprite("nakkong",x,y-bounce,46,opacity);
            StorySprite("muning",x+58,y-Mathf.Abs(Mathf.Cos(storyAnimationTime*7))*walk,46,opacity);
        }

        void StoryFridge(float openness,bool full,bool showCookie=true)
        {
            Box(new Rect(200,14,130,139),new Color(.77f,.88f,.92f));
            Box(new Rect(207,20,116,126),new Color(.13f,.2f,.32f));
            for(int y=58;y<145;y+=40)Box(new Rect(210,y,110,3),new Color(.56f,.76f,.83f));
            if(full)
                for(int i=0;i<6;i++)StorySprite("theme-food-"+i,228+i%3*35,42+i/3*40,28);
            if(showCookie)StorySprite("cookie",267,125,25);
            float width=116*(1-openness);
            if(width>1)
            {
                Box(new Rect(207,20,width,126),new Color(.65f,.81f,.88f));
                Box(new Rect(207+width*.8f,75,3,22),Cream);
            }
        }

        void StoryTrail(float p)
        {
            for(int i=0;i<14;i++)
            {
                float phase=Mathf.Repeat(storyAnimationTime*.1f+i*.071f,1);
                float x=25+i*25,y=142-phase*126;
                StorySprite("bubble",x,y,8+5*Mathf.Sin(i),.12f+.2f*p);
            }
        }

        void DrawAnimatedPrologue()
        {
            float p=StoryProgress,t=storyAnimationTime;
            GUI.BeginGroup(new Rect(72,91,368,166));
            Box(new Rect(0,0,368,166),new Color(.09f,.13f,.24f));
            Box(new Rect(0,145,368,21),new Color(.19f,.23f,.34f));
            StoryTrail(p);
            switch(storyPage)
            {
                case 0:
                    StoryFridge(Cue(p,0,.24f),true);
                    StoryFriends(60+25*Cue(p,0,.2f),123,2);
                    StorySprite("cookie",114,104-7*Mathf.Sin(t*1.5f),23);
                    break;
                case 1:
                    StoryFridge(Cue(p,0,.28f),false,false);
                    StoryFriends(78,124-5*Cue(p,.28f,.4f));
                    if(p>.3f)Label(85,65,95,25,"어? 간식이…",small);
                    StorySprite("cookie",267,125,25+4*Mathf.Sin(t*2));
                    break;
                case 2:
                    StoryFridge(1,false,false);
                    float reach=Cue(p,0,.24f),enter=Cue(p,.62f,.9f);
                    StoryFriends(95+60*reach,124,reach<1?3:0);
                    StorySprite("cookie",Mathf.Lerp(267,215,reach),Mathf.Lerp(125,104,reach),25);
                    float bx=Mathf.Lerp(244,290,enter),by=Mathf.Lerp(100,55,Cue(p,.18f,.55f));
                    float visible=Cue(p,.16f,.28f)*(1-enter);
                    StorySprite("bubble",bx,by,43,visible);
                    // Three tiny syrup marks inside the clue bubble.
                    for(int i=0;i<3;i++)Box(new Rect(bx-8+i*6,by-3+i%2*6,4,6),new Color(1,.27f,.44f,visible));
                    break;
                case 3:
                    DrawStoryPortal();
                    float chase=Cue(p,.45f,1);
                    StorySprite("ghost_enemy-v0",245+90*Cue(p,0,.7f),72+4*Mathf.Sin(t*3),38,1-chase*.7f);
                    StorySprite("strawberry",245+90*Cue(p,0,.7f),92,23,1-chase*.7f);
                    StoryFriends(65+200*chase,125-20*chase,5,1-chase*.8f);
                    break;
                case 4:
                    string[] names={"도쿄빙수","케이크","아이스크림","마카롱","수족관","수박"};
                    for(int i=0;i<6;i++)
                    {
                        float reveal=Cue(p,i*.1f,i*.1f+.15f);
                        float x=57+i%3*122,y=39+i/3*70;
                        if(i%3<2)Box(new Rect(x+23,y,76,2),new Color(.55f,.73f,.8f,reveal));
                        StorySprite("theme-food-"+i,x,y+10*(1-reveal),32*reveal,reveal);
                        if(reveal>.5f)Label(x-35,y+19,100,20,names[i],small);
                    }
                    break;
                case 5:
                    float shot=Cue(p,.08f,.42f),caught=Cue(p,.42f,.55f),rise=Cue(p,.55f,.95f);
                    StoryFriends(62,124,1);
                    StorySprite(caught>.5f?"ghost_enemy-v0-trapped":"ghost_enemy-v0",284,100-55*rise,40);
                    StorySprite("bubble",Mathf.Lerp(84,284,shot),100-55*rise,46,Cue(p,.04f,.12f));
                    StorySprite("strawberry",Mathf.Lerp(284,135,Cue(p,.56f,.9f)),Mathf.Lerp(110,133,rise),26);
                    break;
                case 6:
                    StoryFriends(151,123,1);
                    float split=Cue(p,.16f,.48f);
                    var cookie=Art("cookie").texture;
                    GUI.DrawTextureWithTexCoords(new Rect(169-26*split,75,15,30),cookie,new Rect(0,0,.5f,1),true);
                    GUI.DrawTextureWithTexCoords(new Rect(184+26*split,75,15,30),cookie,new Rect(.5f,0,.5f,1),true);
                    if(p>.55f)Label(135,37,150,24,"함께라면 괜찮아!",small);
                    break;
                default:
                    Box(new Rect(198,36,146,110),new Color(.6f,.77f,.86f));
                    Box(new Rect(210,68,122,62),new Color(.18f,.31f,.45f));
                    for(int i=0;i<7;i++)Box(new Rect(191+i*23,33,23,19),i%2==0?Pink:Cream);
                    Label(237,10,100,22,"도쿄빙수",text);
                    StorySprite("ghost_enemy-v0",260+18*Mathf.Sin(t),93,34);
                    StorySprite("theme-food-0",260+18*Mathf.Sin(t),115,30);
                    StoryFriends(38+107*Cue(p,0,.85f),126,4);
                    break;
            }
            // Fade in each shot, including when replaying or returning to a page.
            Box(new Rect(0,0,368,166),new Color(.055f,.04f,.13f,1-Mathf.Clamp01(t/.45f)));
            Box(new Rect(0,163,368*p,3),Pink);
            GUI.EndGroup();
        }

        void DrawStoryPortal()
        {
            for(int i=0;i<5;i++)
                Box(new Rect(205+i*12,12+i*11,140-i*24,138-i*22),
                    Color.Lerp(new Color(.22f,.5f,.65f),new Color(.12f,.16f,.34f),i/4f));
        }
    }
}
