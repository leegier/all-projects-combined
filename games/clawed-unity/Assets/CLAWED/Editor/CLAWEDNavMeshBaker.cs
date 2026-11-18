// CLAWED NavMesh Baker — runs in batch mode via -executeMethod
// Usage: Unity.exe -batchmode -quit -projectPath ... -executeMethod CLAWED.Editor.CLAWEDNavMeshBaker.BakeAndSave
//
// Also available from the menu: CLAWED > Bake NavMesh

#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.AI;
using UnityEngine.SceneManagement;
using System.IO;

namespace CLAWED.Editor
{
    public static class CLAWEDNavMeshBaker
    {
        const string ScenePath = "Assets/CLAWED/Scenes/PrisonLevel01.unity";

        [MenuItem("CLAWED/Bake NavMesh")]
        public static void BakeAndSave()
        {
            Debug.Log("[CLAWED] Starting NavMesh bake...");

            // Open the scene if not already open
            var activeScene = SceneManager.GetActiveScene();
            if (!activeScene.path.EndsWith("PrisonLevel01.unity"))
            {
                Debug.Log($"[CLAWED] Opening scene: {ScenePath}");
                EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
                activeScene = SceneManager.GetActiveScene();
            }

            // Bake NavMesh
            UnityEditor.AI.NavMeshBuilder.BuildNavMesh();
            Debug.Log("[CLAWED] NavMesh bake complete.");

            // Save the scene
            EditorSceneManager.MarkSceneDirty(activeScene);
            EditorSceneManager.SaveScene(activeScene, ScenePath);
            Debug.Log("[CLAWED] Scene saved after NavMesh bake: " + ScenePath);

            // In batch mode, explicitly quit
            if (Application.isBatchMode)
            {
                EditorApplication.Exit(0);
            }
        }
    }
}
#endif
