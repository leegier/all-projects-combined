// CLAWED Build Pipeline — Windows standalone build for itch.io
// Usage: Unity.exe -batchmode -quit -projectPath ... -executeMethod CLAWED.Editor.BuildPipeline.BuildWindows
// Output: Builds/CLAWED_v0.1/CLAWED.exe

#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;
using System.IO;

namespace CLAWED.Editor
{
    public static class BuildPipeline
    {
        const string OutputDir  = "Builds/CLAWED_v0.1";
        const string ExeName    = "CLAWED.exe";
        const string ScenePath  = "Assets/CLAWED/Scenes/PrisonLevel01.unity";

        [MenuItem("CLAWED/Build Windows (itch.io)")]
        public static void BuildWindows()
        {
            Debug.Log("[CLAWED] Starting Windows build...");

            // Ensure output directory exists
            Directory.CreateDirectory(OutputDir);

            var buildOptions = new BuildPlayerOptions
            {
                scenes          = new[] { ScenePath },
                locationPathName = Path.Combine(OutputDir, ExeName),
                target          = BuildTarget.StandaloneWindows64,
                options         = BuildOptions.None,
            };

            var report = UnityEditor.BuildPipeline.BuildPlayer(buildOptions);

            if (report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded)
            {
                Debug.Log($"[CLAWED] Build succeeded! Output: {OutputDir}/{ExeName}");
                Debug.Log($"[CLAWED] Build size: {report.summary.totalSize / 1024 / 1024} MB");
            }
            else
            {
                Debug.LogError($"[CLAWED] Build FAILED: {report.summary.result}");
                if (Application.isBatchMode)
                    EditorApplication.Exit(1);
            }

            if (Application.isBatchMode)
                EditorApplication.Exit(0);
        }
    }
}
#endif
