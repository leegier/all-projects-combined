using UnityEngine;
using CLAWED.Player;

namespace CLAWED.Systems
{
    /// <summary>
    /// Tracks player visibility to guards.
    /// Visibility is 0 (invisible) to 1 (fully visible).
    /// Factors: distance, light level, movement speed, crouching.
    /// Guards should query PlayerVisibility before detecting.
    /// </summary>
    public class StealthSystem : MonoBehaviour
    {
        public static StealthSystem Instance { get; private set; }

        [Range(0, 1)] public float PlayerVisibility;

        [Header("Factors")]
        public float MovementNoiseMultiplier = 1.5f;  // sprinting increases detection
        public float CrouchVisibilityMult = 0.4f;     // crouching reduces visibility
        public float DarkAreaMult = 0.5f;             // dark areas reduce visibility

        PlayerController _player;
        PlayerSurvival _survival;
        CharacterController _cc;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        void Start()
        {
            var playerObj = GameObject.FindWithTag("Player");
            if (playerObj)
            {
                _player = playerObj.GetComponent<PlayerController>();
                _survival = playerObj.GetComponent<PlayerSurvival>();
                _cc = playerObj.GetComponent<CharacterController>();
            }
        }

        void Update()
        {
            if (_player == null) return;
            CalculateVisibility();
        }

        void CalculateVisibility()
        {
            float visibility = 0.5f; // base

            // Speed factor — use CharacterController.velocity (matches PlayerController)
            float speed = _cc != null ? _cc.velocity.magnitude : 0f;
            if (_survival != null && _survival.IsSprinting)
                visibility += 0.3f;
            else if (speed > 0.1f)
                visibility += 0.1f;

            // Crouching — PlayerController exposes IsCrouching
            if (_player.IsCrouching)
                visibility *= CrouchVisibilityMult;

            // Clamp
            PlayerVisibility = Mathf.Clamp01(visibility);
        }

        public float GetNoiseLevel()
        {
            if (_survival == null) return 0f;
            if (_survival.IsSprinting) return 1f;
            if (_player != null && _player.IsCrouching) return 0.15f;
            return 0.4f; // walking
        }
    }
}
