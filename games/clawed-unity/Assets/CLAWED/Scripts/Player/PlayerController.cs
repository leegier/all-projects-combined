using UnityEngine;
using UnityEngine.InputSystem;

namespace CLAWED.Player
{
    /// <summary>
    /// Third-person player movement. Requires CharacterController + PlayerSurvival.
    /// Works with Unity's Input System (uses the ThirdPersonController InputActions from the package).
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    [RequireComponent(typeof(PlayerSurvival))]
    public class PlayerController : MonoBehaviour
    {
        [Header("Movement")]
        public float WalkSpeed = 3f;
        public float SprintSpeed = 6f;
        public float CrouchSpeed = 1.5f;
        public float JumpHeight = 1.2f;
        public float Gravity = -9.81f;
        public float RotationSpeed = 10f;

        [Header("Ground Check")]
        public Transform GroundCheck;
        public float GroundDistance = 0.4f;
        public LayerMask GroundMask;

        [Header("Camera")]
        public Transform CameraTransform;

        CharacterController _cc;
        PlayerSurvival _survival;
        Vector3 _velocity;
        Vector2 _moveInput;
        bool _isGrounded;
        bool _isCrouching;
        bool _wantSprint;

        void Awake()
        {
            _cc = GetComponent<CharacterController>();
            _survival = GetComponent<PlayerSurvival>();
            if (CameraTransform == null)
                CameraTransform = Camera.main?.transform;
        }

        // Called by Input System
        public void OnMove(InputValue value) => _moveInput = value.Get<Vector2>();
        public void OnSprint(InputValue value) => _wantSprint = value.isPressed;
        public void OnCrouch(InputValue value) => _isCrouching = !_isCrouching;
        public void OnJump(InputValue value)
        {
            if (_isGrounded && !_isCrouching)
                _velocity.y = Mathf.Sqrt(JumpHeight * -2f * Gravity);
        }

        void Update()
        {
            if (_survival.IsDead) return;

            CheckGround();
            Move();
            ApplyGravity();
        }

        // Public properties for other systems (animator, camera, audio)
        public bool IsGrounded   => _isGrounded;
        public bool IsCrouching  => _isCrouching;
        public float CurrentSpeed => _isCrouching ? CrouchSpeed : (_wantSprint && _survival != null && _survival.Stamina > 0 ? SprintSpeed : (_moveInput.magnitude > 0.1f ? WalkSpeed : 0f));

        void CheckGround()
        {
            Vector3 checkPos = GroundCheck != null ? GroundCheck.position : transform.position + Vector3.down * 0.9f;
            _isGrounded = Physics.CheckSphere(checkPos, GroundDistance, GroundMask);

            if (_isGrounded && _velocity.y < 0)
                _velocity.y = -2f;
        }

        void Move()
        {
            // Determine speed
            bool canSprint = _wantSprint && _survival.Stamina > 0 && !_isCrouching;
            _survival.IsSprinting = canSprint;

            float speed = _isCrouching ? CrouchSpeed : (canSprint ? SprintSpeed : WalkSpeed);

            // Get camera-relative direction
            Vector3 camForward = CameraTransform != null ? CameraTransform.forward : Vector3.forward;
            Vector3 camRight = CameraTransform != null ? CameraTransform.right : Vector3.right;
            camForward.y = 0; camForward.Normalize();
            camRight.y = 0; camRight.Normalize();

            Vector3 move = camForward * _moveInput.y + camRight * _moveInput.x;

            if (move.magnitude > 0.1f)
            {
                // Rotate toward move direction
                Quaternion targetRot = Quaternion.LookRotation(move);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, RotationSpeed * Time.deltaTime);
            }

            _cc.Move(move * speed * Time.deltaTime);
        }

        void ApplyGravity()
        {
            _velocity.y += Gravity * Time.deltaTime;
            _cc.Move(_velocity * Time.deltaTime);
        }

        void OnDrawGizmosSelected()
        {
            if (GroundCheck != null)
            {
                Gizmos.color = Color.green;
                Gizmos.DrawWireSphere(GroundCheck.position, GroundDistance);
            }
        }
    }
}
