// CLAWED Auto Scene Builder — Editor script
// Menu: CLAWED > Build Scene
// This script builds the complete PrisonLevel01 scene programmatically.
// Run it once after opening the project in Unity Editor.

#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.AI;
using System.IO;

namespace CLAWED.Editor
{
    public static class CLAWEDSceneBuilder
    {
        const string SceneOutputPath = "Assets/CLAWED/Scenes/PrisonLevel01.unity";
        const string LockDownScenePath = "Assets/Grim/LockDown Prison/Scenes/LockDown Demo.unity";

        [MenuItem("CLAWED/Build Scene (Auto Setup)")]
        public static void BuildScene()
        {
            // 1. Copy the prison demo scene as our base
            if (!File.Exists(Application.dataPath + "/../" + SceneOutputPath))
            {
                string src = Application.dataPath + "/../" + LockDownScenePath;
                string dst = Application.dataPath + "/../" + SceneOutputPath;
                Directory.CreateDirectory(Path.GetDirectoryName(dst));
                File.Copy(src, dst, true);
                AssetDatabase.Refresh();
                Debug.Log("[CLAWED] Copied LockDown Demo scene.");
            }

            // Open our scene
            var scene = EditorSceneManager.OpenScene(SceneOutputPath, OpenSceneMode.Single);

            // 2. Create _GameManager
            var gmGO = CreateOrFind("_GameManager");
            EnsureComponent<CLAWED.Core.GameManager>(gmGO);
            EnsureComponent<CLAWED.Systems.AlertSystem>(gmGO);

            // 3. Create Player
            var playerGO = CreateOrFind("Player");
            playerGO.tag = "Player";
            EnsureComponent<CharacterController>(playerGO);
            EnsureComponent<CLAWED.Player.PlayerSurvival>(playerGO);
            EnsureComponent<CLAWED.Player.PlayerController>(playerGO);
            EnsureComponent<CLAWED.Systems.InventorySystem>(playerGO);
            EnsureComponent<CLAWED.Systems.StealthSystem>(playerGO);

            // Ground check child
            var gc = GetOrCreateChild(playerGO, "GroundCheck");
            gc.transform.localPosition = new Vector3(0, -0.9f, 0);
            var pc = playerGO.GetComponent<CLAWED.Player.PlayerController>();
            pc.GroundCheck = gc.transform;
            pc.CameraTransform = Camera.main?.transform;
            pc.GroundMask = LayerMask.GetMask("Default");

            // Wire GameManager player ref
            var gm = gmGO.GetComponent<CLAWED.Core.GameManager>();
            gm.Player = playerGO.GetComponent<CLAWED.Player.PlayerSurvival>();

            // Position player at spawn
            playerGO.transform.position = new Vector3(0, 1f, 0);

            // 4. Spawn one Guard with patrol waypoints
            SetupGuard();

            // 5. Spawn interactables
            SetupInteractables();

            // 6. Create Canvas HUD
            SetupHUD();

            // 7. Save
            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene, SceneOutputPath);

            Debug.Log("[CLAWED] Scene built and saved to " + SceneOutputPath);
            EditorUtility.DisplayDialog("CLAWED", "Scene built! Open it from:\nAssets/CLAWED/Scenes/PrisonLevel01.unity\n\nNext: Bake NavMesh (Window > AI > Navigation > Bake)", "OK");
        }

        static void SetupGuard()
        {
            var guardGO = CreateOrFind("Guard_01");
            guardGO.tag = "Untagged";

            // Try to find an NPC prefab
            string[] guids = AssetDatabase.FindAssets("npc_csl_00_character_01f_01 t:Prefab");
            if (guids.Length > 0)
            {
                string path = AssetDatabase.GUIDToAssetPath(guids[0]);
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                if (prefab != null)
                {
                    var visual = GetOrCreateChild(guardGO, "Visual");
                    PrefabUtility.InstantiatePrefab(prefab, visual.transform);
                }
            }

            var agent = EnsureComponent<NavMeshAgent>(guardGO);
            agent.speed = 2f;
            agent.radius = 0.3f;
            agent.height = 1.8f;

            var guard = EnsureComponent<CLAWED.AI.GuardAI>(guardGO);
            guard.SightRange = 15f;
            guard.SightAngle = 60f;
            guard.AttackDamage = 15f;
            guard.PlayerLayer = LayerMask.GetMask("Default");
            guard.ObstacleLayer = LayerMask.GetMask("Default");

            // Create 4 patrol waypoints in a loop around a central area
            var wpParent = CreateOrFind("GuardWaypoints");
            Vector3[] positions = {
                new Vector3(2, 0, 2), new Vector3(8, 0, 2),
                new Vector3(8, 0, -4), new Vector3(2, 0, -4)
            };
            var waypoints = new Transform[positions.Length];
            for (int i = 0; i < positions.Length; i++)
            {
                var wp = GetOrCreateChild(wpParent, $"WP_{i+1}");
                wp.transform.position = positions[i];
                waypoints[i] = wp.transform;
            }
            guard.Waypoints = waypoints;
            guardGO.transform.position = new Vector3(2, 1f, 2);
        }

        static void SetupInteractables()
        {
            // Food item
            CreateInteractable("Food_Bread", new Vector3(5, 0.5f, 0),
                CLAWED.Systems.ItemType.Food, "Bread", 30f, Color.yellow);

            // Water
            CreateInteractable("Water_Bottle", new Vector3(-3, 0.5f, 3),
                CLAWED.Systems.ItemType.Water, "Water Bottle", 40f, Color.cyan);

            // Keycard
            CreateInteractable("KeyCard_CellKey", new Vector3(10, 0.5f, -2),
                CLAWED.Systems.ItemType.KeyCard, "Cell Key", 0f, Color.green);

            // Escape door marker (empty — attach to actual door prefab in scene)
            var escapeDoor = CreateOrFind("EscapeDoor_Marker");
            escapeDoor.transform.position = new Vector3(15, 1f, 0);
            escapeDoor.tag = "EscapeDoor";
            var door = EnsureComponent<CLAWED.Systems.PrisonDoor>(escapeDoor);
            door.RequiresKeyCard = true;
            door.RequiredKeyCardName = "Cell Key";
            door.InteractLabel = "Press E — Escape";
        }

        static void CreateInteractable(string name, Vector3 pos, CLAWED.Systems.ItemType type, string itemName, float value, Color color)
        {
            var go = CreateOrFind(name);
            go.transform.position = pos;

            // Visual: colored cube
            if (go.GetComponent<MeshRenderer>() == null)
            {
                var cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
                cube.transform.SetParent(go.transform);
                cube.transform.localScale = Vector3.one * 0.3f;
                cube.transform.localPosition = Vector3.zero;
                var mat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
                mat.color = color;
                cube.GetComponent<MeshRenderer>().sharedMaterial = mat;
            }

            var interactable = EnsureComponent<CLAWED.Systems.InteractableObject>(go);
            interactable.DropsItem = true;
            interactable.ItemType = type;
            interactable.ItemName = itemName;
            interactable.ItemValue = value;
            interactable.OneTimeUse = true;
            interactable.InteractLabel = $"Press E — Pick up {itemName}";
        }

        static void SetupHUD()
        {
            // HUD Canvas is created via UI — needs Canvas component
            // Just create the HUDController container; user wires UI in Inspector
            var hudGO = CreateOrFind("_HUD");
            EnsureComponent<CLAWED.UI.HUDController>(hudGO);
            Debug.Log("[CLAWED] HUD object created. Wire up Canvas + Sliders in Inspector.");
        }

        // --- Helpers ---

        static GameObject CreateOrFind(string name)
        {
            var existing = GameObject.Find(name);
            return existing != null ? existing : new GameObject(name);
        }

        static GameObject GetOrCreateChild(GameObject parent, string childName)
        {
            var t = parent.transform.Find(childName);
            if (t != null) return t.gameObject;
            var child = new GameObject(childName);
            child.transform.SetParent(parent.transform, false);
            return child;
        }

        static T EnsureComponent<T>(GameObject go) where T : Component
        {
            var c = go.GetComponent<T>();
            return c != null ? c : go.AddComponent<T>();
        }
    }
}
#endif
