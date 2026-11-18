using UnityEngine;
using UnityEngine.AI;
using CLAWED.Systems;

namespace CLAWED.AI
{
    /// <summary>
    /// Guard AI: patrols waypoints, detects player by sight/sound, chases and attacks.
    /// Requires NavMeshAgent component.
    /// </summary>
    [RequireComponent(typeof(NavMeshAgent))]
    public class GuardAI : MonoBehaviour
    {
        public enum GuardState { Patrolling, Suspicious, Chasing, Attacking, Searching }

        [Header("State")]
        public GuardState State = GuardState.Patrolling;

        [Header("Patrol")]
        public Transform[] Waypoints;
        private int _waypointIndex;

        [Header("Detection")]
        public float SightRange = 15f;
        public float SightAngle = 60f;
        public float HearingRange = 8f;
        public LayerMask PlayerLayer;
        public LayerMask ObstacleLayer;

        [Header("Combat")]
        public float AttackRange = 2f;
        public float AttackDamage = 15f;
        public float AttackCooldown = 1.5f;
        private float _attackTimer;

        [Header("Speeds")]
        public float PatrolSpeed = 2f;
        public float ChaseSpeed = 5f;

        NavMeshAgent _agent;
        Transform _player;
        Vector3 _lastKnownPlayerPos;
        float _suspicionTimer;
        float _searchTimer;

        void Awake()
        {
            _agent = GetComponent<NavMeshAgent>();
        }

        void Start()
        {
            AlertSystem.Instance?.RegisterGuard(this);
            var playerObj = GameObject.FindWithTag("Player");
            if (playerObj) _player = playerObj.transform;

            GoToNextWaypoint();
        }

        void OnDestroy()
        {
            AlertSystem.Instance?.UnregisterGuard(this);
        }

        void Update()
        {
            _attackTimer -= Time.deltaTime;

            switch (State)
            {
                case GuardState.Patrolling: Patrol(); DetectPlayer(); break;
                case GuardState.Suspicious: Suspicious(); break;
                case GuardState.Chasing: Chase(); break;
                case GuardState.Attacking: Attack(); break;
                case GuardState.Searching: Search(); break;
            }
        }

        void Patrol()
        {
            if (!_agent.pathPending && _agent.remainingDistance < 0.5f)
                GoToNextWaypoint();
        }

        void GoToNextWaypoint()
        {
            if (Waypoints == null || Waypoints.Length == 0) return;
            _agent.speed = PatrolSpeed;
            _agent.SetDestination(Waypoints[_waypointIndex].position);
            _waypointIndex = (_waypointIndex + 1) % Waypoints.Length;
        }

        void DetectPlayer()
        {
            if (_player == null) return;

            float dist = Vector3.Distance(transform.position, _player.position);

            // Sight check
            if (dist <= SightRange)
            {
                Vector3 dir = (_player.position - transform.position).normalized;
                float angle = Vector3.Angle(transform.forward, dir);

                if (angle < SightAngle * 0.5f)
                {
                    if (!Physics.Raycast(transform.position + Vector3.up, dir, dist, ObstacleLayer))
                    {
                        SpotPlayer();
                        return;
                    }
                }
            }

            // Hearing check (if player is crouching they make less noise — handled by noise multiplier)
            if (dist <= HearingRange)
            {
                SetState(GuardState.Suspicious);
                _lastKnownPlayerPos = _player.position;
            }
        }

        void SpotPlayer()
        {
            _lastKnownPlayerPos = _player.position;
            AlertSystem.Instance?.RaiseAlert(40f, _player.position);
            SetState(GuardState.Chasing);
        }

        void Suspicious()
        {
            _suspicionTimer += Time.deltaTime;
            _agent.SetDestination(_lastKnownPlayerPos);
            _agent.speed = PatrolSpeed;

            if (CanSeePlayer()) { SpotPlayer(); return; }

            if (_suspicionTimer > 5f)
            {
                _suspicionTimer = 0;
                SetState(GuardState.Patrolling);
            }
        }

        void Chase()
        {
            if (_player == null) return;
            _agent.speed = ChaseSpeed;

            if (CanSeePlayer())
            {
                _lastKnownPlayerPos = _player.position;
                _agent.SetDestination(_player.position);

                float dist = Vector3.Distance(transform.position, _player.position);
                if (dist <= AttackRange)
                    SetState(GuardState.Attacking);
            }
            else
            {
                // Lost sight — search last known position
                _agent.SetDestination(_lastKnownPlayerPos);
                if (_agent.remainingDistance < 1f)
                    SetState(GuardState.Searching);
            }
        }

        void Attack()
        {
            if (_player == null) return;
            _agent.SetDestination(transform.position); // stop moving

            float dist = Vector3.Distance(transform.position, _player.position);
            if (dist > AttackRange + 0.5f) { SetState(GuardState.Chasing); return; }

            transform.LookAt(_player);

            if (_attackTimer <= 0)
            {
                _attackTimer = AttackCooldown;
                var survival = _player.GetComponent<Player.PlayerSurvival>();
                survival?.TakeDamage(AttackDamage);
                AlertSystem.Instance?.RaiseAlert(10f, transform.position);
            }
        }

        void Search()
        {
            _searchTimer += Time.deltaTime;
            if (CanSeePlayer()) { SpotPlayer(); return; }

            if (_searchTimer > 10f)
            {
                _searchTimer = 0;
                SetState(GuardState.Patrolling);
            }
        }

        bool CanSeePlayer()
        {
            if (_player == null) return false;
            float dist = Vector3.Distance(transform.position, _player.position);
            if (dist > SightRange) return false;
            Vector3 dir = (_player.position - transform.position).normalized;
            float angle = Vector3.Angle(transform.forward, dir);
            if (angle > SightAngle * 0.5f) return false;
            return !Physics.Raycast(transform.position + Vector3.up, dir, dist, ObstacleLayer);
        }

        void SetState(GuardState newState)
        {
            State = newState;
        }

        public void OnAlertRaised(int alertLevel, Vector3 sourcePos)
        {
            if (State == GuardState.Patrolling && alertLevel >= 2)
            {
                _lastKnownPlayerPos = sourcePos;
                SetState(GuardState.Searching);
            }
        }

        void OnDrawGizmosSelected()
        {
            Gizmos.color = Color.yellow;
            Gizmos.DrawWireSphere(transform.position, SightRange);
            Gizmos.color = Color.red;
            Gizmos.DrawWireSphere(transform.position, HearingRange);
            Gizmos.color = Color.magenta;
            Gizmos.DrawWireSphere(transform.position, AttackRange);
        }
    }
}
