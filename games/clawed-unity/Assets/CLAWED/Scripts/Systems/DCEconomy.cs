using System;
using System.Collections.Generic;
using UnityEngine;

namespace CLAWED.Systems
{
    /// <summary>
    /// Prison currency (DC) economy system.
    /// Ported from UE5 UDCEconomySubsystem.
    /// DCs are earned via work details, gambling, dealing, and favors.
    /// Spent at the Barrio Commissary for items, info, protection, and hits.
    /// Singleton — attach to a persistent manager GameObject.
    /// </summary>
    public class DCEconomy : MonoBehaviour
    {
        public static DCEconomy Instance { get; private set; }

        // ----------------------------------------------------------------
        // Events
        // ----------------------------------------------------------------
        public static event Action<int, int> OnBalanceChanged;   // (newBalance, delta)
        public static event Action<string, int> OnTransactionLogged; // (description, amount)

        // ----------------------------------------------------------------
        // State
        // ----------------------------------------------------------------
        [Header("Starting Balance")]
        [SerializeField] int startingBalance = 50;

        public int Balance { get; private set; }

        readonly List<string> _transactionLog = new();
        const int MaxLogEntries = 100;

        // ----------------------------------------------------------------
        // Lifecycle
        // ----------------------------------------------------------------
        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            Balance = startingBalance;
            Debug.Log($"[CLAWED] DCEconomy: Initialized — starting balance: {Balance} DCs");
        }

        // ----------------------------------------------------------------
        // Public API
        // ----------------------------------------------------------------

        /// <summary>Check if the player can afford an amount.</summary>
        public bool CanAfford(int amount) => Balance >= amount;

        /// <summary>
        /// Spend DCs. Returns true if successful, false if insufficient funds.
        /// </summary>
        public bool SpendDCs(int amount, string reason)
        {
            if (amount <= 0) return false;
            if (!CanAfford(amount))
            {
                Debug.Log($"[CLAWED] DCEconomy: Cannot afford {amount} DCs (have {Balance})");
                return false;
            }

            Balance -= amount;
            string logEntry = $"- {amount} DC: {reason}";
            AddToLog(logEntry);

            OnBalanceChanged?.Invoke(Balance, -amount);
            OnTransactionLogged?.Invoke(reason, -amount);

            Debug.Log($"[CLAWED] DCEconomy: Spent {amount} DCs on '{reason}' — Balance: {Balance}");
            return true;
        }

        /// <summary>Earn DCs from work, favors, gambling, etc.</summary>
        public void EarnDCs(int amount, string source)
        {
            if (amount <= 0) return;

            Balance += amount;
            string logEntry = $"+ {amount} DC: {source}";
            AddToLog(logEntry);

            OnBalanceChanged?.Invoke(Balance, amount);
            OnTransactionLogged?.Invoke(source, amount);

            Debug.Log($"[CLAWED] DCEconomy: Earned {amount} DCs from '{source}' — Balance: {Balance}");
        }

        /// <summary>Force-set balance (for save/load).</summary>
        public void SetBalance(int newBalance)
        {
            int delta = newBalance - Balance;
            Balance = newBalance;
            OnBalanceChanged?.Invoke(Balance, delta);
        }

        /// <summary>Get recent transaction strings for UI.</summary>
        public List<string> GetRecentTransactions(int count = 10)
        {
            int take = Mathf.Min(count, _transactionLog.Count);
            return _transactionLog.GetRange(0, take);
        }

        // ----------------------------------------------------------------
        // Internal
        // ----------------------------------------------------------------
        void AddToLog(string entry)
        {
            _transactionLog.Insert(0, entry);
            if (_transactionLog.Count > MaxLogEntries)
                _transactionLog.RemoveAt(_transactionLog.Count - 1);
        }
    }
}
