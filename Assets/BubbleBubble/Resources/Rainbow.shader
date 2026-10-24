Shader "BubbleBubble/Rainbow"
{
    Properties { [PerRendererData] _MainTex ("Sprite", 2D) = "white" {} _HueTime ("Hue time", Float) = 0 }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" "CanUseSpriteAtlas"="True" }
        Cull Off Lighting Off ZWrite Off Blend SrcAlpha OneMinusSrcAlpha
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            struct appdata { float4 vertex:POSITION; float2 uv:TEXCOORD0; fixed4 color:COLOR; };
            struct v2f { float4 vertex:SV_POSITION; float2 uv:TEXCOORD0; fixed4 color:COLOR; };
            sampler2D _MainTex; float _HueTime;
            v2f vert(appdata v) { v2f o; o.vertex=UnityObjectToClipPos(v.vertex); o.uv=v.uv; o.color=v.color; return o; }
            fixed4 frag(v2f i):SV_Target
            {
                fixed4 c=tex2D(_MainTex,i.uv)*i.color;
                float h=frac(i.uv.x*.6+i.uv.y*.4+_HueTime*.6);
                float3 rgb=saturate(abs(frac(h+float3(0,2.0/3,1.0/3))*6-3)-1);
                c.rgb*=lerp(float3(1,1,1),rgb,.65);return c;
            }
            ENDCG
        }
    }
}
