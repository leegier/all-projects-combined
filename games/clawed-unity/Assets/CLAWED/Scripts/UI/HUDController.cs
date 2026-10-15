using UnityEngine;
using UnityEngine.UI;
using TMPro;
using CLAWED.Player;
using CLAWED.Systems;
using CLAWED.Core;

namespace CLAWED.UI
{
    /// <summary>
    /// Prison survival HUD. Wire up the UI elements in the Inspector.
    /// Listens to events from PlayerSurvival and AlertSystem.
    /// </summary>
    public class HUDController : MonoBehaviour
    {
        [Header("Stat Bars")]
        public Slider HealthBar;
        public Slider HungerBar;
        public Slider ThirstBar;
        public Slider StaminaBar;

        [Header("Alert")]
        public TextMeshProUGUI AlertLabel;
        public Image AlertPanel; // background that changes color
        public Color CalmColor = Color.green;
        public Color SuspiciousColor = Color.yellow;
        public Color SearchingColor = Color.red;
        public Color LockdownColor = new Color(0.8f, 0f, 0.8f);

        [Header("Interaction")]
        public TextMeshProUGUI InteractPrompt;

        [Header("Death Screen")]
        public GameObject DeathScreen;

        [Header("Escape Screen")]
        public GameObject EscapeScreen;

        void OnEnable()
        {
            PlayerSurvival.OnHealthChanged += UpdateHealth;
            PlayerSurvival.OnHungerChanged += UpdateHunger;
            PlayerSurvival.OnThirstChanged += UpdateThirst;
            PlayerSurvival.OnStaminaChanged += UpdateStamina;
            AlertSystem.OnAlertLevelChanged += UpdateAlert;
            GameManager.OnGameStateChanged += OnGameStateChanged;
        }

        void OnDisable()
        {
            PlayerSurvival.OnHealthChanged -= UpdateHealth;
            PlayerSurvival.OnHungerChanged -= UpdateHunger;
            PlayerSurvival.OnThirstChanged -= UpdateThirst;
            PlayerSurvival.OnStaminaChanged -= UpdateStamina;
            AlertSystem.OnAlertLevelChanged -= UpdateAlert;
            GameManager.OnGameStateChanged -= OnGameStateChanged;
        }

        void Start()
        {
            if (DeathScreen) DeathScreen.SetActive(false);
            if (EscapeScreen) EscapeScreen.SetActive(false);
            UpdateAlert(0);
        }

        void UpdateHealth(float v) { if (HealthBar) HealthBar.value = v / 100f; }
        void UpdateHunger(float v) { if (HungerBar) HungerBar.value = v / 100f; }
        void UpdateThirst(float v) { if (ThirstBar) ThirstBar.value = v / 100f; }
        void UpdateStamina(float v) { if (StaminaBar) StaminaBar.value = v / 100f; }

        void UpdateAlert(int level)
        {
            var sys = AlertSystem.Instance;
            if (AlertLabel) AlertLabel.text = sys?.GetAlertLabel() ?? "CALM";

            Color c = level switch
            {
                0 => CalmColor,
                1 => SuspiciousColor,
                2 => SearchingColor,
                _ => LockdownColor
            };

            if (AlertPanel) AlertPanel.color = new Color(c.r, c.g, c.b, 0.4f);
            if (AlertLabel) AlertLabel.color = c;
        }

        void OnGameStateChanged(GameState state)
        {
            if (state == GameState.Dead && DeathScreen)
                DeathScreen.SetActive(true);

            if (state == GameState.Escaped && EscapeScreen)
                EscapeScreen.SetActive(true);
        }

        public void SetInteractPrompt(string text)
        {
            if (InteractPrompt)
            {
                InteractPrompt.text = text;
                InteractPrompt.gameObject.SetActive(!string.IsNullOrEmpty(text));
            }
        }
    }
}
