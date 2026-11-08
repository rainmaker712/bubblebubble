using UnityEngine;

namespace BubbleBubble
{
    public sealed partial class GameApp
    {
        // Image provenance and original download URLs: docs/brand-assets.json.
        static readonly string[] BrandImages={"tokyo","cake","icecream","macaron","aquarium","watermelon"};
        static readonly string[] BrandNames={"도쿄빙수","파리바게뜨","배스킨라빈스","배스킨라빈스","롯데월드 아쿠아리움","롯데 수박바"};
        static readonly string[] BrandCaptions={"방울방울 토마토 빙수","초콜릿 케이크 공방","슈팅스타 아이스크림 나라","아이스 마카롱 정원","바닷속 친구들의 수족관","시원한 수박바 코너"};
        static readonly string[] BrandAccents={"#EE7279","#699DE0","#F489BE","#D3A3E8","#65D9ED","#83D87C"};
        Sprite brandPanel;

        Color BrandAccent
        {
            get { ColorUtility.TryParseHtmlString(BrandAccents[World.StageIndex],out var color);return color; }
        }

        void BrandRect(string name,float x,float y,float width,float height,Color color,int order)
        {
            if(brandPanel==null)
            {
                brandPanel=Sprite.Create(Texture2D.whiteTexture,new Rect(0,0,1,1),new Vector2(.5f,.5f),1);
            }
            var obj=new GameObject(name);obj.transform.SetParent(transform);
            var renderer=obj.AddComponent<SpriteRenderer>();renderer.sharedMaterial=defaultMaterial;
            renderer.sprite=brandPanel;renderer.color=color;renderer.sortingOrder=order;
            SetPose(renderer,x,y,width,height);scenery.Add(obj);
        }

        void BrandPhoto(string name,float x,float y,float width,float height,float opacity)
        {
            string key="Brands/"+BrandImages[drawnStage];var sprite=Art(key);
            float fit=Mathf.Min(width/sprite.bounds.size.x,height/sprite.bounds.size.y);
            var renderer=MakeSprite(name,key,x,y,sprite.bounds.size.x*fit,sprite.bounds.size.y*fit,-8);
            renderer.color=new Color(1,1,1,opacity);scenery.Add(renderer.gameObject);
        }

        void DrawBrandBackdrop()
        {
            var accent=BrandAccent;
            // A framed shop display gives high-resolution photographs a quiet place behind the action.
            BrandRect("Brand display frame",256,236,422,322,new Color(accent.r,accent.g,accent.b,.25f),-12);
            BrandRect("Brand display glass",256,236,414,314,new Color(.035f,.055f,.1f,.94f),-11);
            BrandRect("Brand display base",256,393,420,5,accent,-7);
            BrandPhoto("Brand hero",256,235,350,256,drawnStage==4?.48f:.65f);
            for(int side=0;side<2;side++)
            {
                float x=side==0?39:473;
                BrandRect("Brand side light",x,233,2,310,new Color(accent.r,accent.g,accent.b,.6f),-7);
            }
            // Bright platform edges preserve the collision silhouette over photographic detail.
            var layout=World.Stage.layout;
            for(int y=1;y<layout.Length-1;y++)for(int x=1;x<layout[y].Length-1;x++)
                if(layout[y][x]=='#' && layout[y-1][x]!='#')
                    BrandRect("Brand platform edge",x*32+16,y*32+2,30,3,accent,-4);
        }

        void DrawBrandSign()
        {
            if(World.Phase==GamePhase.Menu || showingStory)return;
            Box(new Rect(116,33,280,29),new Color(.035f,.045f,.08f,.94f));
            Box(new Rect(116,33,3,29),BrandAccent);
            var heading=new GUIStyle(text){alignment=TextAnchor.MiddleCenter,fontSize=12,fontStyle=FontStyle.Bold};
            heading.normal.textColor=BrandAccent;
            Label(122,33,268,17,BrandNames[World.StageIndex],heading);
            var caption=new GUIStyle(small){alignment=TextAnchor.MiddleCenter};
            Label(122,49,268,12,BrandCaptions[World.StageIndex],caption);
        }
    }
}
