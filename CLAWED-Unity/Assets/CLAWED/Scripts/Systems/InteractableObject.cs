using UnityEngine;
using UnityEngine.InputSystem;
using CLAWED.Systems;

namespace CLAWED.Systems
{
    /// <summary>
    /// Base class for interactable objects (doors, food, keycards, escape vents, etc.)
    /// Player presses Interact (mapped in InputActions) when nearby to interact.
    /// Uses Unity Input System — listens to the Interact action via PlayerInput callbacks.
    /// </summary>
    public class InteractableObject : MonoBehaviour
    {
        [Header("Interaction")]
        public string InteractLabel = "Press E to interact";
        public float InteractRange = 2.5f;
        public bool OneTimeUse = false;
        private bool _used;

        [Header("Item Drop (optional)")]
        public bool DropsItem;
        public string ItemName;
        public ItemType ItemType;
        public float ItemValue;

        protected Transform _player;
        private PlayerInput _playerInput;
        private InputAction _interactAction;

        protected virtual void Start()
        {
            var playerObj = GameObject.FindWithTag("Player");
            if (playerObj)
            {
                _player = playerObj.transform;
                _playerInput = playerObj.GetComponent<PlayerInput>();
                if (_playerInput != null)
                {
                    _interactAction = _playerInput.actions.FindAction("Interact");
                }
            }
        }

        protected virtual void Update()
        {
            if (_used) return;
            if (_player == null) return;

            float dist = Vector3.Distance(transform.position, _player.position);
            if (dist <= InteractRange && _interactAction != null && _interactAction.WasPressedThisFrame())
                Interact();
        }

        protected virtual void Interact()
        {
            if (_used && OneTimeUse) return;

            if (DropsItem)
            {
                var inv = _player.GetComponent<InventorySystem>();
                if (inv != null)
                {
                    var item = new Item(ItemName, ItemType, ItemValue);
                    if (inv.AddItem(item))
                    {
                        Debug.Log($"[CLAWED] Picked up: {ItemName}");
                        if (OneTimeUse) { _used = true; gameObject.SetActive(false); }
                    }
                }
            }
        }

        void OnDrawGizmosSelected()
        {
            Gizmos.color = Color.cyan;
            Gizmos.DrawWireSphere(transform.position, InteractRange);
        }
    }

    /// <summary>
    /// Prison door — requires a keycard to open, or can be forced open slowly.
    /// </summary>
    public class PrisonDoor : InteractableObject
    {
        public bool RequiresKeyCard = true;
        public string RequiredKeyCardName = "Cell Key";
        public bool IsOpen;

        [Header("Animation")]
        public Animator DoorAnimator;
        public string OpenTrigger = "Open";

        protected override void Interact()
        {
            if (IsOpen) return;

            if (RequiresKeyCard)
            {
                var inv = _player?.GetComponent<InventorySystem>();
                var key = inv?.Items.Find(i => i.Type == ItemType.KeyCard && i.Name == RequiredKeyCardName);
                if (key == null)
                {
                    Debug.Log($"[CLAWED] Need: {RequiredKeyCardName}");
                    return;
                }
            }

            OpenDoor();
        }

        void OpenDoor()
        {
            IsOpen = true;
            DoorAnimator?.SetTrigger(OpenTrigger);
            Debug.Log("[CLAWED] Door opened!");

            // If this is the escape door, trigger win
            if (gameObject.CompareTag("EscapeDoor"))
                Core.GameManager.Instance?.SetState(Core.GameState.Escaped);
        }
    }
}
