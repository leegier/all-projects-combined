using UnityEngine;
using System.Collections.Generic;

namespace CLAWED.Systems
{
    [System.Serializable]
    public class Item
    {
        public string Name;
        public ItemType Type;
        public float Value; // heal/hunger/thirst restore amount
        public Sprite Icon;

        public Item(string name, ItemType type, float value)
        {
            Name = name; Type = type; Value = value;
        }
    }

    public enum ItemType { Food, Water, MedKit, KeyCard, Tool, Weapon }

    /// <summary>
    /// Simple inventory. Attach to the player GameObject.
    /// </summary>
    public class InventorySystem : MonoBehaviour
    {
        public int MaxSlots = 8;
        public List<Item> Items = new();

        public static event System.Action OnInventoryChanged;

        public bool AddItem(Item item)
        {
            if (Items.Count >= MaxSlots)
            {
                Debug.Log("[CLAWED] Inventory full.");
                return false;
            }
            Items.Add(item);
            OnInventoryChanged?.Invoke();
            return true;
        }

        public bool RemoveItem(Item item)
        {
            bool removed = Items.Remove(item);
            if (removed) OnInventoryChanged?.Invoke();
            return removed;
        }

        /// <summary>Use a consumable item on the player.</summary>
        public void UseItem(Item item)
        {
            var survival = GetComponent<Player.PlayerSurvival>();
            if (survival == null) return;

            switch (item.Type)
            {
                case ItemType.Food:    survival.Eat(item.Value);   break;
                case ItemType.Water:   survival.Drink(item.Value); break;
                case ItemType.MedKit:  survival.Heal(item.Value);  break;
                case ItemType.KeyCard:
                    Debug.Log($"[CLAWED] Used keycard: {item.Name}");
                    // Handled by door interaction scripts
                    break;
            }

            RemoveItem(item);
        }

        public bool HasItem(ItemType type) => Items.Exists(i => i.Type == type);
        public Item GetItem(ItemType type) => Items.Find(i => i.Type == type);
    }
}
