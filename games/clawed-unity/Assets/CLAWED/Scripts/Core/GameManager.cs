using UnityEngine;
using UnityEngine.SceneManagement;
using CLAWED.Player;

namespace CLAWED.Core
{
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Game State")]
        public GameState CurrentState = GameState.Playing;

        [Header("References")]
        public PlayerSurvival Player;

        public static event System.Action<GameState> OnGameStateChanged;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        void Start()
        {
            if (Player == null)
                Player = FindFirstObjectByType<PlayerSurvival>();
        }

        public void SetState(GameState newState)
        {
            CurrentState = newState;
            OnGameStateChanged?.Invoke(newState);

            switch (newState)
            {
                case GameState.Paused:
                    Time.timeScale = 0f;
                    break;
                case GameState.Playing:
                    Time.timeScale = 1f;
                    break;
                case GameState.Dead:
                    Time.timeScale = 0f;
                    OnPlayerDied();
                    break;
                case GameState.Escaped:
                    Time.timeScale = 0f;
                    OnPlayerEscaped();
                    break;
            }
        }

        void OnPlayerDied()
        {
            Debug.Log("[CLAWED] Player died. Loading death screen.");
            // TODO: Show death screen UI
        }

        void OnPlayerEscaped()
        {
            Debug.Log("[CLAWED] Player escaped! Victory!");
            // TODO: Show victory/credits screen
        }

        public void RestartGame()
        {
            Time.timeScale = 1f;
            SceneManager.LoadScene(SceneManager.GetActiveScene().name);
        }

        public void QuitGame()
        {
            Application.Quit();
        }
    }

    public enum GameState { Playing, Paused, Dead, Escaped }
}
