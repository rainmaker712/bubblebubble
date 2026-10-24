using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace BubbleBubble.Editor
{
    public sealed class ArtImporter : AssetPostprocessor
    {
        void OnPreprocessTexture()
        {
            if(!assetPath.StartsWith("Assets/BubbleBubble/Resources/Art/",StringComparison.Ordinal))return;
            var importer=(TextureImporter)assetImporter;
            importer.textureType=TextureImporterType.Sprite;importer.spriteImportMode=SpriteImportMode.Single;
            importer.spritePixelsPerUnit=2;importer.filterMode=FilterMode.Point;
            importer.textureCompression=TextureImporterCompression.Uncompressed;
            importer.mipmapEnabled=false;importer.alphaIsTransparency=true;importer.maxTextureSize=2048;
        }
    }
    [InitializeOnLoad]
    public static class ProjectSetup
    {
        public const string ScenePath="Assets/BubbleBubble/Scenes/Main.unity";
        static ProjectSetup() { EditorApplication.delayCall+=EnsureScene; }
        static void EnsureScene()
        {
            if(EditorApplication.isPlayingOrWillChangePlaymode || EditorApplication.isCompiling)return;
            if(!File.Exists(ScenePath))Configure();
        }
        [MenuItem("BubbleBubble/Configure Project")]
        public static void Configure()
        {
            EditorSettings.serializationMode=SerializationMode.ForceText;
            EditorSettings.defaultBehaviorMode=EditorBehaviorMode.Mode2D;
            PlayerSettings.companyName="BubbleBubble";PlayerSettings.productName="BubbleBubble";
            PlayerSettings.bundleVersion="1.0.0";
            PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Standalone,"com.bubblebubble.game");
            PlayerSettings.defaultScreenWidth=1024;PlayerSettings.defaultScreenHeight=896;
            PlayerSettings.fullScreenMode=FullScreenMode.Windowed;PlayerSettings.resizableWindow=true;
            PlayerSettings.runInBackground=false;PlayerSettings.colorSpace=ColorSpace.Gamma;
            // Keyboard polling uses Unity's built-in input manager; no third-party package is required.
            var settings=new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset"));
            var input=settings.FindProperty("activeInputHandler");if(input!=null){input.intValue=0;settings.ApplyModifiedPropertiesWithoutUndo();}
            if(!File.Exists(ScenePath))
            {
                var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
                new GameObject("BubbleBubble").AddComponent<GameApp>();
                EditorSceneManager.SaveScene(scene,ScenePath);
            }
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(ScenePath,true)};
            AssetDatabase.SaveAssets();Debug.Log("BubbleBubble configured. Open Main and press Play.");
        }
        [MenuItem("BubbleBubble/Open Game Scene")]
        public static void OpenGame() { if(!File.Exists(ScenePath))Configure();EditorSceneManager.OpenScene(ScenePath); }
        [MenuItem("BubbleBubble/Build/macOS")]
        public static void BuildMac() { Build(BuildTarget.StandaloneOSX,"Builds/macOS/BubbleBubble.app"); }
        [MenuItem("BubbleBubble/Build/Windows")]
        public static void BuildWindows() { Build(BuildTarget.StandaloneWindows64,"Builds/Windows/BubbleBubble.exe"); }
        [MenuItem("BubbleBubble/Build/Web")]
        public static void BuildWeb() { Build(BuildTarget.WebGL,"Builds/Web"); }
        static void Build(BuildTarget target,string output)
        {
            Configure();Directory.CreateDirectory(Path.GetDirectoryName(output));
            var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{ScenePath},locationPathName=output,target=target,options=BuildOptions.None});
            if(report.summary.result!=BuildResult.Succeeded)throw new InvalidOperationException("Build failed: "+report.summary.result);
            Debug.Log("Build completed: "+Path.GetFullPath(output));
        }
    }
}
