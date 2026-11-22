using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace MineCraft.Editor
{
    // Builds MineCraft as its own app without touching BubbleBubble's build scene list.
    public static class MineCraftBuild
    {
        public const string ScenePath = "Assets/MineCraft/Scenes/MineCraft.unity";

        [MenuItem("MineCraft/Create Scene")]
        public static void CreateScene()
        {
            if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("MineCraft").AddComponent<MineCraftGame>();
            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
            EditorSceneManager.SaveScene(scene, ScenePath);
            Debug.Log("MineCraft scene created: " + ScenePath);
        }

        [MenuItem("MineCraft/Open Scene")]
        public static void OpenScene()
        {
            if (!File.Exists(ScenePath)) CreateScene();
            else if (EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) EditorSceneManager.OpenScene(ScenePath);
        }

        [MenuItem("MineCraft/Build/macOS")]
        public static void BuildMac() => Build(BuildTarget.StandaloneOSX, "Builds/macOS/MineCraft.app");

        [MenuItem("MineCraft/Build/Windows")]
        public static void BuildWindows() => Build(BuildTarget.StandaloneWindows64, "Builds/Windows/MineCraft/MineCraft.exe");

        static void Build(BuildTarget target, string output)
        {
            if (!File.Exists(ScenePath)) CreateScene();
            Directory.CreateDirectory(Path.GetDirectoryName(output));
            // Player settings are shared with BubbleBubble, so swap them for this build only.
            string product = PlayerSettings.productName;
            string id = PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Standalone);
            int width = PlayerSettings.defaultScreenWidth, height = PlayerSettings.defaultScreenHeight;
            try
            {
                PlayerSettings.productName = "MineCraft";
                PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Standalone, "com.bubblebubble.minecraft");
                PlayerSettings.defaultScreenWidth = 1280; PlayerSettings.defaultScreenHeight = 720;
                var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
                {
                    scenes = new[] { ScenePath }, locationPathName = output, target = target, options = BuildOptions.None
                });
                if (report.summary.result != BuildResult.Succeeded) throw new InvalidOperationException("Build failed: " + report.summary.result);
                Debug.Log("MineCraft build completed: " + Path.GetFullPath(output));
            }
            finally
            {
                PlayerSettings.productName = product;
                PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Standalone, id);
                PlayerSettings.defaultScreenWidth = width; PlayerSettings.defaultScreenHeight = height;
                AssetDatabase.SaveAssets();
            }
        }
    }
}
