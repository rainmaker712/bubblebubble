Shader "MineCraft/Voxel"
{
    Properties { _MainTex ("Atlas", 2D) = "white" {} _Color ("Tint", Color) = (1,1,1,1) }
    SubShader
    {
        Tags { "RenderType"="TransparentCutout" "Queue"="AlphaTest" }
        Cull Back ZWrite On
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            struct appdata { float4 vertex:POSITION; float2 uv:TEXCOORD0; fixed4 color:COLOR; };
            struct v2f { float4 vertex:SV_POSITION; float2 uv:TEXCOORD0; fixed4 color:COLOR; float dist:TEXCOORD1; };
            sampler2D _MainTex; fixed4 _Color;
            // Distance fog is computed here instead of using Unity fog keywords, which builds may strip.
            fixed4 _MCFogColor; float _MCFogStart; float _MCFogEnd;
            v2f vert(appdata v)
            {
                v2f o;
                o.vertex=UnityObjectToClipPos(v.vertex);
                o.uv=v.uv;o.color=v.color*_Color;
                o.dist=distance(mul(unity_ObjectToWorld,v.vertex).xyz,_WorldSpaceCameraPos);
                return o;
            }
            fixed4 frag(v2f i):SV_Target
            {
                fixed4 c=tex2D(_MainTex,i.uv)*i.color;
                clip(c.a-.5);
                float f=saturate((i.dist-_MCFogStart)/max(_MCFogEnd-_MCFogStart,.001));
                c.rgb=lerp(c.rgb,_MCFogColor.rgb,f);c.a=1;
                return c;
            }
            ENDCG
        }
    }
}
