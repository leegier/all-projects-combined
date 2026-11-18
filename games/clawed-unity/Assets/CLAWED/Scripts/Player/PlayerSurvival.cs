using UnityEngine;
using CLAWED.Core;

namespace CLAWED.Player
{
    /// <summary>
    /// Core survival stats for the player: health, hunger, thirst, stamina.
    /// Attach to the player GameObject alongside the movement controller.
    /// </summary>
    public class PlayerSurvival : MonoBehaviour
    {
        [Header("Health")]
        [Range(0, 100)] public float Health = 100f;
        public float MaxHealth = 100f;

        [Header("Survival Stats")]
        [Range(0, 100)] public float Hunger = 100f;
        [Range(0, 100)] public float Thirst = 100f;
        [Range(0, 100)] public float Stamina = 100f;
        public float MaxStat = 100f;

        [Header("Drain Rates (per second)")]
        public float HungerDrainRate = 0.5f;
        public float ThirstDrainRate = 0.8f;
        public float StaminaRegenRate = 10f;
        public float StaminaDrainRate = 20f;

        [Header("Damage When Starving")]
        public float StarvationDamage = 2f;
        public float DehydrationDamage = 3f;

        [Header("State")]
        public bool IsSprinting;
        public bool IsDead;

        public static event System.Action<float> OnHealthChanged;
        public static event System.Action<float> OnHungerChanged;
        public static event System.Action<float> OnThirstChanged;
        public static event System.Action<float> OnStaminaChanged;

        void Update()
        {
            if (IsDead) return;

            DrainStats();
            HandleStarvation();
            HandleStamina();
        }

        void DrainStats()
        {
            float dt = Time.deltaTime;

            Hunger = Mathf.Max(0, Hunger - HungerDrainRate * dt);
            Thirst = Mathf.Max(0, Thirst - ThirstDrainRate * dt);

            OnHungerChanged?.Invoke(Hunger);
            OnThirstChanged?.Invoke(Thirst);
        }

        void HandleStarvation()
        {
            float dt = Time.deltaTime;

            if (Hunger <= 0)
                TakeDamage(StarvationDamage * dt);

            if (Thirst <= 0)
                TakeDamage(DehydrationDamage * dt);
        }

        void HandleStamina()
        {
            if (IsSprinting && Stamina > 0)
            {
                Stamina = Mathf.Max(0, Stamina - StaminaDrainRate * Time.deltaTime);
                if (Stamina <= 0) IsSprinting = false;
            }
            else
            {
                Stamina = Mathf.Min(MaxStat, Stamina + StaminaRegenRate * Time.deltaTime);
            }
            OnStaminaChanged?.Invoke(Stamina);
        }

        public void TakeDamage(float amount)
        {
            if (IsDead) return;
            Health = Mathf.Max(0, Health - amount);
            OnHealthChanged?.Invoke(Health);

            if (Health <= 0)
                Die();
        }

        public void Heal(float amount)
        {
            Health = Mathf.Min(MaxHealth, Health + amount);
            OnHealthChanged?.Invoke(Health);
        }

        public void Eat(float amount)
        {
            Hunger = Mathf.Min(MaxStat, Hunger + amount);
            OnHungerChanged?.Invoke(Hunger);
        }

        public void Drink(float amount)
        {
            Thirst = Mathf.Min(MaxStat, Thirst + amount);
            OnThirstChanged?.Invoke(Thirst);
        }

        void Die()
        {
            if (IsDead) return;
            IsDead = true;
            Debug.Log("[CLAWED] Player died.");
            GameManager.Instance?.SetState(GameState.Dead);
        }
    }
}
