using UnityEngine;
using System.Collections.Generic;
using CLAWED.AI;

namespace CLAWED.Systems
{
    /// <summary>
    /// Prison-wide alert state. Guards escalate based on alert level.
    /// AlertLevel 0 = calm, 1 = suspicious, 2 = searching, 3 = lockdown
    /// </summary>
    public class AlertSystem : MonoBehaviour
    {
        public static AlertSystem Instance { get; private set; }

        [Header("Alert State")]
        [Range(0, 3)] public int AlertLevel = 0;
        public float AlertDecayRate = 0.1f; // per second when no new threat
        private float _alertValue = 0f;

        [Header("Thresholds")]
        public float[] LevelThresholds = { 0f, 25f, 60f, 90f };

        public static event System.Action<int> OnAlertLevelChanged;

        readonly List<GuardAI> _guards = new();

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        void Update()
        {
            // Decay alert over time
            _alertValue = Mathf.Max(0, _alertValue - AlertDecayRate * Time.deltaTime);
            UpdateLevel();
        }

        public void RegisterGuard(GuardAI guard) => _guards.Add(guard);
        public void UnregisterGuard(GuardAI guard) => _guards.Remove(guard);

        public void RaiseAlert(float amount, Vector3 sourcePosition)
        {
            _alertValue = Mathf.Min(100f, _alertValue + amount);
            UpdateLevel();

            // Notify all guards
            foreach (var guard in _guards)
                guard.OnAlertRaised(AlertLevel, sourcePosition);
        }

        void UpdateLevel()
        {
            int newLevel = 0;
            for (int i = LevelThresholds.Length - 1; i >= 0; i--)
            {
                if (_alertValue >= LevelThresholds[i]) { newLevel = i; break; }
            }

            if (newLevel != AlertLevel)
            {
                AlertLevel = newLevel;
                OnAlertLevelChanged?.Invoke(AlertLevel);
                Debug.Log($"[CLAWED] Alert level: {AlertLevel}");
            }
        }

        public string GetAlertLabel() => AlertLevel switch
        {
            0 => "CALM",
            1 => "SUSPICIOUS",
            2 => "SEARCHING",
            3 => "LOCKDOWN",
            _ => "UNKNOWN"
        };
    }
}
