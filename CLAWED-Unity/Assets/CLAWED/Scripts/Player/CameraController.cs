using UnityEngine;
using UnityEngine.InputSystem;

namespace CLAWED.Player
{
    /// <summary>
    /// Third-person camera with mouse look and wall collision avoidance.
    /// If Cinemachine is available, consider using CinemachineFreeLook instead.
    /// Attach to the Camera GameObject; set Target to the player root.
    /// Uses Unity Input System (receives OnLook from PlayerInput component).
    /// </summary>
    public class CameraController : MonoBehaviour
    {
        [Header("Target")]
        public Transform Target;
        public Vector3 Offset = new Vector3(0f, 1.8f, -4f);

        [Header("Mouse Look")]
        public float MouseSensitivity = 120f;
        [Range(-40f, 0f)]  public float MinPitch = -20f;
        [Range(0f,  80f)]  public float MaxPitch = 60f;

        [Header("Wall Avoidance")]
        public float MinDistance = 0.5f;
        public LayerMask CollisionMask;

        float _yaw;
        float _pitch;
        Vector2 _lookInput;

        void Start()
        {
            if (Target == null)
            {
                var player = GameObject.FindWithTag("Player");
                if (player) Target = player.transform;
            }
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible   = false;
        }

        /// <summary>Called by Unity Input System via PlayerInput component.</summary>
        public void OnLook(InputValue value)
        {
            _lookInput = value.Get<Vector2>();
        }

        void LateUpdate()
        {
            if (Target == null) return;

            // Mouse input via Input System
            _yaw   += _lookInput.x * MouseSensitivity * Time.deltaTime;
            _pitch -= _lookInput.y * MouseSensitivity * Time.deltaTime;
            _pitch  = Mathf.Clamp(_pitch, MinPitch, MaxPitch);

            // Desired position
            Quaternion rotation = Quaternion.Euler(_pitch, _yaw, 0f);
            Vector3 desiredPos  = Target.position + rotation * Offset;

            // Wall collision — pull camera in if blocked
            Vector3 dir    = desiredPos - Target.position;
            float   maxDist = dir.magnitude;
            if (Physics.SphereCast(Target.position, 0.2f, dir.normalized, out RaycastHit hit, maxDist, CollisionMask))
            {
                float safeDist = Mathf.Max(hit.distance - 0.1f, MinDistance);
                desiredPos = Target.position + dir.normalized * safeDist;
            }

            transform.position = desiredPos;
            transform.LookAt(Target.position + Vector3.up * 1.4f);
        }

        /// <summary>Call this to unlock cursor (e.g., when pausing).</summary>
        public void UnlockCursor()
        {
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible   = true;
        }

        public void LockCursor()
        {
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible   = false;
        }
    }
}
