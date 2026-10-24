using UnityEngine;

namespace BubbleBubble
{
    // Code-drawn pixel art shares the game's point-filtered sprite rendering.
    // No external files or network access are needed in the built player.
    public static class FoodArt
    {
        public static Sprite Create(string name)
        {
            bool food=name.StartsWith("theme-food-");
            bool platform=name.StartsWith("theme-platform-");
            if(!food && !platform && name!="poop-item" && !name.StartsWith("fish-minion"))return null;
            var image=new Texture2D(64,64,TextureFormat.RGBA32,false){name=name,filterMode=FilterMode.Point,wrapMode=TextureWrapMode.Clamp};
            var pixels=new Color32[64*64];
            Color C(string value) { ColorUtility.TryParseHtmlString("#"+value,out var color);return color; }
            void Pixel(int x,int y,string color) { if(x>=0 && x<64 && y>=0 && y<64)pixels[(63-y)*64+x]=C(color); }
            void Rect(int x,int y,int w,int h,string color) { for(int j=y;j<y+h;j++)for(int i=x;i<x+w;i++)Pixel(i,j,color); }
            void Oval(int x,int y,int w,int h,string color)
            {
                for(int j=y;j<y+h;j++)for(int i=x;i<x+w;i++)
                    if(Mathf.Pow((i-x+.5f-w/2f)/(w/2f),2)+Mathf.Pow((j-y+.5f-h/2f)/(h/2f),2)<=1)Pixel(i,j,color);
            }
            void Triangle(int ax,int ay,int bx,int by,int cx,int cy,string color)
            {
                float Edge(int x,int y,int x1,int y1,int x2,int y2)=>(x-x1)*(y2-y1)-(y-y1)*(x2-x1);
                for(int y=Mathf.Min(ay,Mathf.Min(by,cy));y<=Mathf.Max(ay,Mathf.Max(by,cy));y++)
                for(int x=Mathf.Min(ax,Mathf.Min(bx,cx));x<=Mathf.Max(ax,Mathf.Max(bx,cx));x++)
                { float a=Edge(x,y,ax,ay,bx,by),b=Edge(x,y,bx,by,cx,cy),c=Edge(x,y,cx,cy,ax,ay);if((a>=0&&b>=0&&c>=0)||(a<=0&&b<=0&&c<=0))Pixel(x,y,color); }
            }
            if(platform)
            {
                int n=int.Parse(name.Substring("theme-platform-".Length));
                string[] baseColors={"96cbd9","c88876","8acbbb","af88cc","317b9a","3f985a"};
                string[] topColors={"f5f7ed","fff0da","e5fff0","f8c3d9","8cddd8","a6e57d"};
                Rect(0,0,64,64,"1c2941");Rect(2,3,60,57,baseColors[n]);Rect(2,3,60,11,topColors[n]);
                Rect(4,54,56,6,"294457");
                if(n==1) { Rect(2,25,60,7,"fae6c3");Rect(2,40,60,6,"c65372"); }
                else if(n==3) { Rect(2,28,60,9,"ffe6c9");Rect(3,23,58,4,"e5b7ec"); }
                else if(n==5)
                { Rect(6,14,52,33,"f16e7f");for(int x=14;x<55;x+=16)Rect(x,24+(x%3)*4,3,6,"493545"); }
                else for(int x=8;x<60;x+=17) { Rect(x,22,5,4,topColors[n]);Rect(x+5,40,4,4,topColors[n]); }
            }
            else if(name=="poop-item")
            {
                Oval(7,37,50,21,"432d32");Oval(10,35,44,18,"a76843");
                Oval(16,24,34,20,"432d32");Oval(18,23,30,17,"b97a4e");
                Triangle(25,25,44,25,36,7,"432d32");Triangle(27,24,41,24,35,10,"c88d59");
                Rect(22,37,5,6,"fff1cd");Rect(38,37,5,6,"fff1cd");Rect(24,39,3,4,"342635");Rect(38,39,3,4,"342635");Rect(29,48,8,3,"432d32");
                Rect(6,14,3,12,"c7d97d");Rect(52,8,3,12,"c7d97d");
            }
            else if(name.StartsWith("fish-minion"))
            {
                Triangle(5,15,5,49,28,32,"397f98");Triangle(9,21,9,43,27,32,"79dfdc");
                Triangle(26,20,38,5,44,24,"438da4");Oval(17,17,43,32,"19435e");Oval(20,20,37,26,"72d9dd");
                Oval(26,35,24,9,"c1f3da");Rect(44,25,8,9,"fff5d5");Rect(48,28,4,5,"d44865");
                Triangle(28,33,39,34,30,43,"2c829d");
                if(name.EndsWith("-trapped")) { Rect(46,27,3,3,"243a56");Rect(49,30,3,3,"243a56"); }
            }
            else
            {
                int n=int.Parse(name.Substring("theme-food-".Length));
                if(n==0) // Strawberry shaved ice, in a blue glass bowl.
                {
                    Oval(8,11,48,39,"d2eaf3");Oval(14,9,36,30,"fff8e9");
                    Rect(19,18,28,6,"f28a9d");Rect(16,24,10,9,"ef6885");Rect(37,21,9,13,"ef6885");
                    Oval(28,6,12,13,"e94f6b");Rect(31,3,7,4,"8bbe70");
                    Triangle(6,37,58,37,43,57,"4b9cbf");Triangle(6,37,43,57,21,57,"70c4d4");Rect(8,36,48,5,"c7f0ec");Rect(23,57,18,4,"9cdae1");
                }
                else if(n==1)
                {
                    Rect(9,23,46,34,"734353");Rect(12,27,40,27,"ecc39a");Rect(12,36,40,7,"fff0d1");Rect(12,44,40,5,"e06e8b");
                    Oval(9,16,46,15,"fff4dc");Rect(10,23,44,7,"fff4dc");Rect(16,27,6,8,"fff4dc");
                    Oval(25,7,15,17,"ef5c7b");Rect(29,5,9,4,"78b885");Rect(29,12,2,3,"ffe8bc");Rect(35,16,2,3,"ffe8bc");
                }
                else if(n==2)
                {
                    Triangle(15,31,49,31,32,62,"d49c60");Triangle(19,33,45,33,32,56,"f0c78b");
                    Rect(25,39,14,3,"cf985f");Rect(28,47,8,2,"cf985f");
                    Oval(8,15,30,25,"9fe6cb");Oval(27,15,30,25,"f6accc");Oval(20,3,27,27,"fff1c9");
                    Rect(25,9,3,5,"ed7c94");Rect(35,12,5,2,"7ac5bc");Rect(37,25,3,5,"f7e7ac");
                }
                else if(n==3)
                {
                    Oval(7,33,49,24,"9974bc");Rect(9,40,44,8,"f9e4ce");Oval(7,26,49,22,"c9a2e4");
                    Oval(13,18,41,23,"b1e6c4");Rect(15,26,37,7,"fff2d1");Oval(13,10,41,22,"f3b3c8");
                    Rect(22,16,15,3,"ffe0e5");Rect(15,32,20,3,"dfc2ed");
                }
                else if(n==4)
                {
                    Triangle(6,17,6,48,29,32,"f3a959");Oval(17,15,41,34,"f6c567");
                    Triangle(29,18,40,7,45,19,"ea8566");Rect(29,20,5,24,"fff0cd");Rect(40,19,4,26,"fff0cd");
                    Oval(46,24,8,9,"fff9e8");Rect(50,27,3,4,"244059");Triangle(29,31,38,33,29,42,"e98966");
                    Oval(4,5,5,5,"94e8e4");Oval(56,9,5,5,"94e8e4");
                }
                else
                {
                    Triangle(4,13,60,13,32,61,"2e8656");Triangle(7,14,57,14,32,56,"b9e896");Triangle(11,15,53,15,32,50,"f17583");
                    Rect(20,20,3,6,"503848");Rect(40,20,3,6,"503848");Rect(30,27,3,6,"503848");Rect(30,38,3,5,"503848");
                }
            }
            image.SetPixels32(pixels);image.Apply();
            return Sprite.Create(image,new Rect(0,0,64,64),new Vector2(.5f,.5f),2);
        }
    }
}
