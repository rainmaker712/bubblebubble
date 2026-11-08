using UnityEngine;

namespace BubbleBubble
{
    public sealed partial class GameApp
    {
        static readonly string[] EndingSnacks={"Brands/tokyo","Brands/cake","Brands/icecream","Brands/macaron","Brands/watermelon","cookie"};

        void DrawAnimatedEnding()
        {
            float p=StoryProgress,t=storyAnimationTime;
            GUI.BeginGroup(new Rect(72,91,368,166));
            Box(new Rect(0,0,368,166),new Color(.12f,.10f,.22f));
            Box(new Rect(0,145,368,21),new Color(.29f,.22f,.32f));
            StoryTrail(p);
            switch(storyPage)
            {
                case 0: DrawEndingCelebration(p,t);break;
                case 1: DrawEndingHomecoming(p);break;
                case 2: DrawEndingFridge(p);break;
                default: DrawEndingSharing(p,t);break;
            }
            Box(new Rect(0,0,368,166),new Color(.055f,.04f,.13f,1-Mathf.Clamp01(t/.45f)));
            Box(new Rect(0,163,368*p,3),Cream);
            GUI.EndGroup();
        }

        void DrawEndingCelebration(float p,float t)
        {
            float burst=Cue(p,.12f,.27f),scatter=Cue(p,.2f,.62f);
            StorySprite(World.Boss!=null?World.Boss.art:"boss-king",184,67,52*(1-.6f*burst),1-burst);
            StorySprite("bubble",184,67,82+32*burst,1-burst);
            for(int i=0;i<12;i++)
            {
                float angle=i*Mathf.PI/6;
                StorySprite("spark",184+Mathf.Cos(angle)*95*burst,67+Mathf.Sin(angle)*54*burst,
                    8,Mathf.Sin(burst*Mathf.PI));
            }
            for(int i=0;i<EndingSnacks.Length;i++)
            {
                float x=Mathf.Lerp(184,44+i*55,scatter);
                float y=Mathf.Lerp(67,96+(i%2)*16,scatter)-Mathf.Sin(scatter*Mathf.PI)*38;
                StorySprite(EndingSnacks[i],x,y,30,Cue(p,.18f,.3f));
            }
            float cheer=Cue(p,.55f,.75f);
            StoryFriends(151,135-Mathf.Abs(Mathf.Sin(t*5))*5*cheer);
            if(p>.72f)Label(125,20,160,24,"간식을 되찾았어!",text);
        }

        void DrawEndingHomecoming(float p)
        {
            float travel=Cue(p,.05f,.82f),home=Cue(p,.52f,.9f);
            // Landmarks pass in reverse order on the way back from the last stage.
            for(int i=0;i<6;i++)
            {
                float x=60+i*86-410*travel;
                StorySprite("theme-food-"+(5-i),x,55,38,1-home);
                if(i<5)Box(new Rect(x+23,57,38,2),new Color(.8f,.7f,.9f,(1-home)*.5f));
            }
            var previous=GUI.color;GUI.color=new Color(1,1,1,home);
            StoryFridge(home,false,false);GUI.color=previous;
            float friendX=Mathf.Lerp(32,135,travel);
            StoryFriends(friendX,125,travel<1?4:0);
            // A basket of recovered snacks travels with the two friends.
            Box(new Rect(friendX+14,107,30,23),new Color(.7f,.43f,.25f));
            StorySprite("Brands/cake",friendX+23,104,20);
            StorySprite("Brands/watermelon",friendX+37,103,21);
            for(int i=0;i<5;i++)StorySprite("bubble",50+i*60,147,8,.45f);
        }

        void DrawEndingFridge(float p)
        {
            StoryFridge(1,false,false);
            StoryFriends(70,125,1);
            for(int i=0;i<EndingSnacks.Length;i++)
            {
                // Cake belongs on the middle shelf; watermelon on the bottom shelf.
                float targetX=i==1?240:i==4?280:i==2?265:i==3?300:230;
                float targetY=i==1?81:i==4?124:i==5?124:40;
                float place=Cue(p,.04f+i*.12f,.2f+i*.12f);
                if(place<=0)continue;
                float x=Mathf.Lerp(126,targetX,place);
                float y=Mathf.Lerp(113,targetY,place)-Mathf.Sin(place*Mathf.PI)*24;
                StorySprite(EndingSnacks[i],x,y,27);
                if(place<1)StorySprite("spark",x+15,y-12,10,Mathf.Sin(place*Mathf.PI));
            }
            if(p>.85f)Label(28,25,170,22,"다시 가득 찼네!",text);
        }

        void DrawEndingSharing(float p,float t)
        {
            StoryFridge(1,true);
            StoryFriends(65,124,1);
            Box(new Rect(42,136,104,7),new Color(.77f,.5f,.34f));
            Box(new Rect(50,143,6,17),new Color(.5f,.3f,.25f));
            Box(new Rect(132,143,6,17),new Color(.5f,.3f,.25f));
            float share=Cue(p,.1f,.48f);
            StorySprite("Brands/tokyo",Mathf.Lerp(94,66,share),105,36);
            StorySprite("Brands/tokyo",Mathf.Lerp(94,123,share),105,36,share);
            var cookie=Art("cookie").texture;
            GUI.DrawTextureWithTexCoords(new Rect(84-20*share,128,10,12),cookie,new Rect(0,0,.5f,1),true);
            GUI.DrawTextureWithTexCoords(new Rect(94+20*share,128,10,12),cookie,new Rect(.5f,0,.5f,1),true);
            for(int i=0;i<5;i++)
                StorySprite("spark",50+i*25,67+5*Mathf.Sin(t*2+i),7,Cue(p,.5f,.7f)*(.65f+.35f*Mathf.Sin(t*3+i)));
            if(p>.62f)Label(29,26,175,24,"내일도 반씩 나눠 먹자!",text);
        }
    }
}
