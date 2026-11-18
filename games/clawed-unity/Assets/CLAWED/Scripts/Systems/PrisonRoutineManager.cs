using System;
using UnityEngine;

namespace CLAWED.Systems
{
    /// <summary>
    /// Day/night cycle and prison routine system.
    /// Ported from UE5 PrisonRoutineSubsystem + NH_GameMode time system.
    /// Drives 11 routine slots across the prison day.
    /// Other systems subscribe to OnRoutineSlotChanged to react.
    /// </summary>
    public class PrisonRoutineManager : MonoBehaviour
    {
        public static PrisonRoutineManager Instance { get; private set; }

        // ----------------------------------------------------------------
        // Routine Slots (mirrors UE5 ENH_RoutineSlot)
        // ----------------------------------------------------------------
        public enum RoutineSlot
        {
            Count,        // Census / head count
            Chow,         // Meal time
            Yard,         // Yard time
            WorkDetail,   // Work assignments
            Chapel,       // Chapel / religion
            Library,      // Library time
            Gym,          // Gymnasium
            Visitation,   // Visitor hours
            Lockdown,     // Emergency lockdown
            LightsOut,    // Sleep
            FreeTime      // Unstructured
        }

        // ----------------------------------------------------------------
        // Serializable routine entry (equivalent to FNH_RoutineRow)
        // ----------------------------------------------------------------
        [Serializable]
        public class RoutineEntry
        {
            [Range(0, 23)] public int StartHour = 6;
            [Range(1, 24)] public int DurationHours = 1;
            public RoutineSlot Slot = RoutineSlot.FreeTime;
            public string Announcement = "";
            public bool Mandatory = false;
        }

        // ----------------------------------------------------------------
        // Inspector configuration
        // ----------------------------------------------------------------
        [Header("Time Settings")]
        [Tooltip("Real seconds per in-game hour")]
        [SerializeField] float realSecondsPerGameHour = 120f;
        [SerializeField] float startingHour = 6f;

        [Header("Routine Schedule")]
        [Tooltip("Define the daily prison schedule. Order does not matter.")]
        [SerializeField] RoutineEntry[] schedule = new RoutineEntry[]
        {
            new() { StartHour = 6,  DurationHours = 1, Slot = RoutineSlot.Count,      Announcement = "COUNT TIME — all inmates to cells!", Mandatory = true },
            new() { StartHour = 7,  DurationHours = 1, Slot = RoutineSlot.Chow,       Announcement = "CHOW — report to mess hall.",        Mandatory = true },
            new() { StartHour = 8,  DurationHours = 2, Slot = RoutineSlot.WorkDetail,  Announcement = "WORK DETAIL — report to assignments." },
            new() { StartHour = 10, DurationHours = 1, Slot = RoutineSlot.Yard,        Announcement = "YARD TIME — exercise period." },
            new() { StartHour = 11, DurationHours = 1, Slot = RoutineSlot.FreeTime,    Announcement = "FREE TIME." },
            new() { StartHour = 12, DurationHours = 1, Slot = RoutineSlot.Chow,        Announcement = "CHOW — lunch period.",              Mandatory = true },
            new() { StartHour = 13, DurationHours = 2, Slot = RoutineSlot.Library,     Announcement = "LIBRARY / CHAPEL access." },
            new() { StartHour = 15, DurationHours = 1, Slot = RoutineSlot.Gym,         Announcement = "GYM — rec period." },
            new() { StartHour = 16, DurationHours = 1, Slot = RoutineSlot.Visitation,  Announcement = "VISITATION — report to visiting room." },
            new() { StartHour = 17, DurationHours = 1, Slot = RoutineSlot.Chow,        Announcement = "CHOW — dinner.",                    Mandatory = true },
            new() { StartHour = 18, DurationHours = 3, Slot = RoutineSlot.FreeTime,    Announcement = "FREE TIME — evening recreation." },
            new() { StartHour = 21, DurationHours = 1, Slot = RoutineSlot.Count,       Announcement = "COUNT TIME — final count!",         Mandatory = true },
            new() { StartHour = 22, DurationHours = 8, Slot = RoutineSlot.LightsOut,   Announcement = "LIGHTS OUT — all inmates in cells.", Mandatory = true },
        };

        // ----------------------------------------------------------------
        // Events
        // ----------------------------------------------------------------
        public static event Action<RoutineSlot, string> OnRoutineSlotChanged;
        public static event Action<int> OnHourChanged;
        public static event Action<int> OnNewDay;
        public static event Action OnCountTime;
        public static event Action OnLockdownBegan;
        public static event Action OnLockdownEnded;

        // ----------------------------------------------------------------
        // Public state
        // ----------------------------------------------------------------
        public float CurrentHour { get; private set; }
        public int CurrentDay { get; private set; } = 1;
        public RoutineSlot CurrentSlot { get; private set; } = RoutineSlot.LightsOut;
        public string CurrentAnnouncement { get; private set; } = "";
        public bool IsEmergencyLockdown { get; private set; }

        // ----------------------------------------------------------------
        // Internals
        // ----------------------------------------------------------------
        float _hourAccumulator;
        int _lastBroadcastHour = -1;
        float _lockdownEndsAtHour = -1f;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        void Start()
        {
            CurrentHour = startingHour;
            _lastBroadcastHour = Mathf.FloorToInt(CurrentHour);
            EvaluateSlotForHour(_lastBroadcastHour);
        }

        void Update()
        {
            if (Core.GameManager.Instance != null &&
                Core.GameManager.Instance.CurrentState != Core.GameState.Playing)
                return;

            AdvanceTime();
        }

        void AdvanceTime()
        {
            _hourAccumulator += Time.deltaTime;

            if (_hourAccumulator >= realSecondsPerGameHour)
            {
                _hourAccumulator -= realSecondsPerGameHour;
                int prevHour = Mathf.FloorToInt(CurrentHour);
                CurrentHour += 1f;

                if (CurrentHour >= 24f)
                {
                    CurrentHour = 0f;
                    CurrentDay++;
                    OnNewDay?.Invoke(CurrentDay);
                    Debug.Log($"[CLAWED] New day — Day {CurrentDay}");
                }

                int newHour = Mathf.FloorToInt(CurrentHour);
                if (newHour != prevHour)
                {
                    _lastBroadcastHour = newHour;
                    OnHourChanged?.Invoke(newHour);
                    EvaluateSlotForHour(newHour);
                }
            }
        }

        void EvaluateSlotForHour(int hour)
        {
            // Handle lockdown
            if (IsEmergencyLockdown)
            {
                if (_lockdownEndsAtHour >= 0f && hour >= _lockdownEndsAtHour)
                {
                    IsEmergencyLockdown = false;
                    OnLockdownEnded?.Invoke();
                    Debug.Log($"[CLAWED] Emergency lockdown lifted at hour {hour}");
                }
                else
                {
                    return; // Stay in lockdown
                }
            }

            // Find the best matching routine entry
            RoutineEntry best = null;
            int bestStart = -1;

            foreach (var entry in schedule)
            {
                int endHour = entry.StartHour + entry.DurationHours;
                bool covers;

                if (endHour >= 24)
                {
                    // Wrap-around (e.g., 22:00 to 06:00)
                    covers = (hour >= entry.StartHour || hour < (endHour - 24));
                }
                else
                {
                    covers = (hour >= entry.StartHour && hour < endHour);
                }

                if (covers && entry.StartHour > bestStart)
                {
                    bestStart = entry.StartHour;
                    best = entry;
                }
            }

            if (best != null && best.Slot != CurrentSlot)
            {
                CurrentSlot = best.Slot;
                CurrentAnnouncement = best.Announcement;
                OnRoutineSlotChanged?.Invoke(CurrentSlot, CurrentAnnouncement);

                if (CurrentSlot == RoutineSlot.Count)
                    OnCountTime?.Invoke();

                Debug.Log($"[CLAWED] Hour {hour} — Slot: {CurrentSlot} — {CurrentAnnouncement}");
            }
        }

        // ----------------------------------------------------------------
        // Public API
        // ----------------------------------------------------------------

        /// <summary>Trigger an emergency lockdown for a given duration (in game hours).</summary>
        public void TriggerEmergencyLockdown(float durationHours = 2f)
        {
            IsEmergencyLockdown = true;
            _lockdownEndsAtHour = CurrentHour + durationHours;
            if (_lockdownEndsAtHour >= 24f) _lockdownEndsAtHour -= 24f;

            CurrentSlot = RoutineSlot.Lockdown;
            CurrentAnnouncement = "EMERGENCY LOCKDOWN — all inmates to cells immediately!";
            OnRoutineSlotChanged?.Invoke(CurrentSlot, CurrentAnnouncement);
            OnLockdownBegan?.Invoke();

            Debug.Log($"[CLAWED] EMERGENCY LOCKDOWN — {durationHours:F1} hours");
        }

        /// <summary>Get the schedule entry for a given hour, or null.</summary>
        public RoutineEntry GetEntryForHour(int hour)
        {
            foreach (var entry in schedule)
            {
                int endHour = entry.StartHour + entry.DurationHours;
                bool covers = endHour >= 24
                    ? (hour >= entry.StartHour || hour < (endHour - 24))
                    : (hour >= entry.StartHour && hour < endHour);
                if (covers) return entry;
            }
            return null;
        }

        /// <summary>Get time as HH:MM string for UI display.</summary>
        public string GetTimeString()
        {
            int h = Mathf.FloorToInt(CurrentHour);
            int m = Mathf.FloorToInt((CurrentHour - h) * 60f);
            return $"{h:D2}:{m:D2}";
        }

        /// <summary>Get normalized time of day (0–1) for lighting/skybox.</summary>
        public float GetNormalizedTime() => CurrentHour / 24f;
    }
}
