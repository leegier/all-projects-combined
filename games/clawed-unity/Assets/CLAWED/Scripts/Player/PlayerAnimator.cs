using UnityEngine;

namespace CLAWED.Player
{
    [RequireComponent(typeof(Animator))]
    public class PlayerAnimator : MonoBehaviour
    {
        private Animator _animator;
        private PlayerController _controller;

        // Animator parameter hashes
        private static readonly int SpeedHash    = Animator.StringToHash("Speed");
        private static readonly int IsGroundedHash = Animator.StringToHash("IsGrounded");
        private static readonly int IsCrouchingHash = Animator.StringToHash("IsCrouching");
        private static readonly int DieHash      = Animator.StringToHash("Die");

        private void Awake()
        {
            _animator   = GetComponent<Animator>();
            _controller = GetComponentInParent<PlayerController>();

            if (_controller == null)
                _controller = GetComponent<PlayerController>();
        }

        private void Update()
        {
            if (_controller == null) return;

            float speed = _controller.CurrentSpeed;
            _animator.SetFloat(SpeedHash, speed, 0.1f, Time.deltaTime);
            _animator.SetBool(IsGroundedHash, _controller.IsGrounded);
            _animator.SetBool(IsCrouchingHash, _controller.IsCrouching);
        }

        public void TriggerDeath()
        {
            _animator.SetTrigger(DieHash);
        }
    }
}
