using UnityEngine;

namespace CLAWED.Systems
{
    /// <summary>
    /// Central audio manager. Plays footsteps based on surface type and ambient horror loops.
    /// Attach to a persistent GameObject in the scene (e.g., GameManager).
    /// </summary>
    public class AudioManager : MonoBehaviour
    {
        public static AudioManager Instance { get; private set; }

        [Header("Footsteps")]
        public AudioClip[] ConcreteFootsteps;
        public AudioClip[] MetalFootsteps;
        public AudioClip[] DirtFootsteps;
        [Range(0f, 1f)] public float FootstepVolume = 0.6f;

        [Header("Ambient Horror")]
        public AudioClip[] AmbientLoops;
        [Range(0f, 1f)] public float AmbientVolume = 0.25f;

        [Header("Interaction SFX")]
        public AudioClip DoorOpenClip;
        public AudioClip DoorLockedClip;
        public AudioClip ItemPickupClip;
        public AudioClip AlertClip;

        AudioSource _footstepSource;
        AudioSource _ambientSource;
        AudioSource _sfxSource;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            _footstepSource = AddSource("Footsteps", FootstepVolume, false);
            _ambientSource  = AddSource("Ambient",   AmbientVolume, true);
            _sfxSource      = AddSource("SFX",       1f, false);
        }

        void Start()
        {
            if (AmbientLoops != null && AmbientLoops.Length > 0)
                PlayAmbient();
        }

        AudioSource AddSource(string sourceName, float volume, bool loop)
        {
            var go = new GameObject($"AudioSource_{sourceName}");
            go.transform.SetParent(transform);
            var src = go.AddComponent<AudioSource>();
            src.volume = volume;
            src.loop   = loop;
            src.spatialBlend = 0f; // 2D
            return src;
        }

        // ── Footsteps ──────────────────────────────────────────
        public void PlayFootstep(SurfaceType surface = SurfaceType.Concrete)
        {
            AudioClip[] clips = surface switch
            {
                SurfaceType.Metal => MetalFootsteps,
                SurfaceType.Dirt  => DirtFootsteps,
                _                 => ConcreteFootsteps,
            };

            if (clips == null || clips.Length == 0) return;
            var clip = clips[Random.Range(0, clips.Length)];
            _footstepSource.pitch = Random.Range(0.9f, 1.1f);
            _footstepSource.PlayOneShot(clip);
        }

        // ── Ambient ────────────────────────────────────────────
        void PlayAmbient()
        {
            _ambientSource.clip = AmbientLoops[Random.Range(0, AmbientLoops.Length)];
            _ambientSource.Play();
        }

        // ── One-shot SFX ───────────────────────────────────────
        public void PlaySFX(AudioClip clip, float volume = 1f)
        {
            if (clip == null) return;
            _sfxSource.PlayOneShot(clip, volume);
        }

        public void PlayDoorOpen()   => PlaySFX(DoorOpenClip);
        public void PlayDoorLocked() => PlaySFX(DoorLockedClip);
        public void PlayPickup()     => PlaySFX(ItemPickupClip);
        public void PlayAlert()      => PlaySFX(AlertClip);

        public enum SurfaceType { Concrete, Metal, Dirt }
    }
}
