using System;
using System.IO;
using UnityEngine;

namespace CLAWED.Systems
{
    /// <summary>
    /// JSON save/load for player progress and inventory.
    /// Usage: SaveSystem.Save(data) / SaveSystem.Load()
    /// </summary>
    public static class SaveSystem
    {
        static string SavePath => Path.Combine(Application.persistentDataPath, "save.json");

        [Serializable]
        public class SaveData
        {
            // Player stats
            public float Health         = 100f;
            public float Stamina        = 100f;
            public float Suspicion      = 0f;

            // Inventory (item IDs)
            public string[] InventoryIds = Array.Empty<string>();

            // World state
            public bool[] DoorsUnlocked = Array.Empty<bool>();
            public bool   EscapeAchieved = false;

            // Meta
            public string SaveTime = "";
            public int    PlaytimeSeconds = 0;
        }

        public static void Save(SaveData data)
        {
            try
            {
                data.SaveTime = DateTime.UtcNow.ToString("o");
                string json = JsonUtility.ToJson(data, prettyPrint: true);
                File.WriteAllText(SavePath, json);
                Debug.Log($"[CLAWED] Game saved to {SavePath}");
            }
            catch (Exception e)
            {
                Debug.LogError($"[CLAWED] Save failed: {e.Message}");
            }
        }

        public static SaveData Load()
        {
            if (!File.Exists(SavePath))
            {
                Debug.Log("[CLAWED] No save file found — returning default data.");
                return new SaveData();
            }

            try
            {
                string json = File.ReadAllText(SavePath);
                var data = JsonUtility.FromJson<SaveData>(json);
                Debug.Log($"[CLAWED] Save loaded from {SavePath} (saved: {data.SaveTime})");
                return data;
            }
            catch (Exception e)
            {
                Debug.LogError($"[CLAWED] Load failed: {e.Message}. Returning defaults.");
                return new SaveData();
            }
        }

        public static bool HasSave() => File.Exists(SavePath);

        public static void DeleteSave()
        {
            if (File.Exists(SavePath))
            {
                File.Delete(SavePath);
                Debug.Log("[CLAWED] Save file deleted.");
            }
        }
    }
}
