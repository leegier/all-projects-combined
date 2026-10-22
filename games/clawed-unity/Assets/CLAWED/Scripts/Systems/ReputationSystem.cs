using System;
using System.Collections.Generic;
using UnityEngine;

namespace CLAWED.Systems
{
    /// <summary>
    /// Player reputation and faction standing system.
    /// Ported from UE5 UReputationSubsystem.
    /// Tracks StreetCred (global yard rep), Fear, and per-faction standings.
    /// Consulted by NPCs, the Hit Market, quest gates, and dialogue.
    /// Singleton — attach to a persistent manager GameObject.
    /// </summary>
    public class ReputationSystem : MonoBehaviour
    {
        public static ReputationSystem Instance { get; private set; }

        // ----------------------------------------------------------------
        // Factions (mirrors UE5 ENH_Faction)
        // ----------------------------------------------------------------
        public enum Faction
        {
            None,
            Warden,
            Guards,
            GRAVE,
            InmatesGeneral,
            YardCrew,
            Cartel,
            GangBloods,
            GangCrips,
            Aryan,
            SicilianOutfit,
            Independent
        }

        // ----------------------------------------------------------------
        // Faction standing data
        // ----------------------------------------------------------------
        [Serializable]
        public class FactionStanding
        {
            /// <summary>-100 = sworn enemies, 0 = neutral, +100 = fully allied</summary>
            public float Standing;
            public bool OpenContract;
            public bool UnderProtection;

            public FactionStanding(float standing = 0f)
            {
                Standing = standing;
                OpenContract = false;
                UnderProtection = false;
            }
        }

        // ----------------------------------------------------------------
        // Thresholds
        // ----------------------------------------------------------------
        [Header("Thresholds")]
        [SerializeField] float allyThreshold = 60f;
        [SerializeField] float enemyThreshold = -40f;

        // ----------------------------------------------------------------
        // Events
        // ----------------------------------------------------------------
        public static event Action<float, Faction> OnFactionStandingChanged; // (newValue, faction)
        public static event Action<int> OnStreetCredChanged;
        public static event Action<float> OnFearChanged;

        // ----------------------------------------------------------------
        // State
        // ----------------------------------------------------------------
        public int StreetCred { get; private set; }
        public float Fear { get; private set; }

        readonly Dictionary<Faction, FactionStanding> _factionMap = new();

        // ----------------------------------------------------------------
        // Lifecycle
        // ----------------------------------------------------------------
        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            // Initialize all factions at neutral
            foreach (Faction f in Enum.GetValues(typeof(Faction)))
            {
                _factionMap[f] = new FactionStanding(0f);
            }

            Debug.Log($"[CLAWED] ReputationSystem: Initialized — {_factionMap.Count} factions tracked");
        }

        // ----------------------------------------------------------------
        // Street Cred
        // ----------------------------------------------------------------

        /// <summary>Add or subtract street cred. Clamped to [-1000, 1000].</summary>
        public void AddStreetCred(int delta, string reason = "")
        {
            StreetCred = Mathf.Clamp(StreetCred + delta, -1000, 1000);
            Debug.Log($"[CLAWED] Reputation: StreetCred {delta:+#;-#;0} ({reason}) -> {StreetCred}");
            OnStreetCredChanged?.Invoke(StreetCred);
        }

        /// <summary>Seed initial street cred from character creator offense choice.</summary>
        public void SeedFromOffense(int offenseStreetCredStart)
        {
            StreetCred = Mathf.Clamp(offenseStreetCredStart, -100, 100);
            Debug.Log($"[CLAWED] Reputation: Seeded from offense — StreetCred = {StreetCred}");
            OnStreetCredChanged?.Invoke(StreetCred);
        }

        // ----------------------------------------------------------------
        // Fear
        // ----------------------------------------------------------------

        /// <summary>How much the yard fears the player. Clamped to [0, 100].</summary>
        public void AddFear(float delta)
        {
            Fear = Mathf.Clamp(Fear + delta, 0f, 100f);
            OnFearChanged?.Invoke(Fear);
        }

        // ----------------------------------------------------------------
        // Faction Standing
        // ----------------------------------------------------------------

        /// <summary>Modify a faction's standing toward the player. Clamped to [-100, 100].</summary>
        public void ModifyFactionStanding(Faction faction, float delta, string reason = "")
        {
            if (!_factionMap.ContainsKey(faction))
                _factionMap[faction] = new FactionStanding();

            var standing = _factionMap[faction];
            standing.Standing = Mathf.Clamp(standing.Standing + delta, -100f, 100f);

            Debug.Log($"[CLAWED] Reputation: Faction {faction} standing {delta:+0.0;-0.0} ({reason}) -> {standing.Standing:F1}");
            OnFactionStandingChanged?.Invoke(standing.Standing, faction);
        }

        /// <summary>Get current standing with a faction.</summary>
        public float GetFactionStanding(Faction faction)
        {
            return _factionMap.TryGetValue(faction, out var standing) ? standing.Standing : 0f;
        }

        /// <summary>Get full faction standing data.</summary>
        public FactionStanding GetFactionData(Faction faction)
        {
            return _factionMap.TryGetValue(faction, out var standing) ? standing : new FactionStanding();
        }

        /// <summary>Is the player allied with this faction?</summary>
        public bool IsAlliedWith(Faction faction) => GetFactionStanding(faction) >= allyThreshold;

        /// <summary>Is the player hostile with this faction?</summary>
        public bool IsEnemyOf(Faction faction) => GetFactionStanding(faction) <= enemyThreshold;

        /// <summary>Set protection status for a faction.</summary>
        public void SetProtection(Faction faction, bool isProtected)
        {
            if (_factionMap.TryGetValue(faction, out var standing))
                standing.UnderProtection = isProtected;
        }

        /// <summary>Set an open contract from a faction.</summary>
        public void SetOpenContract(Faction faction, bool hasContract)
        {
            if (_factionMap.TryGetValue(faction, out var standing))
                standing.OpenContract = hasContract;
        }

        // ----------------------------------------------------------------
        // Save/Load helpers
        // ----------------------------------------------------------------

        /// <summary>Force set standing (for save/load).</summary>
        public void SetFactionStanding(Faction faction, float value)
        {
            if (!_factionMap.ContainsKey(faction))
                _factionMap[faction] = new FactionStanding();
            _factionMap[faction].Standing = Mathf.Clamp(value, -100f, 100f);
        }

        public void SetStreetCred(int value) => StreetCred = Mathf.Clamp(value, -1000, 1000);
        public void SetFear(float value) => Fear = Mathf.Clamp(value, 0f, 100f);
    }
}
