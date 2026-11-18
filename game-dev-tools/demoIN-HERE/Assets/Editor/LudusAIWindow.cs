using UnityEditor;
using UnityEngine;
using System.Net.Http;
using System.Threading.Tasks;

public class LudusAIWindow : EditorWindow
{
    private string userInput = "";
    private string aiResponse = "";
    private Vector2 scrollPos;

    [MenuItem("Window/Ludus AI Helper")]
    public static void ShowWindow()
    {
        GetWindow<LudusAIWindow>("Ludus AI Helper");
    }

    void OnGUI()
    {
        GUILayout.Label("Ludus AI for Unity 6", EditorStyles.boldLabel);
        GUILayout.Label("Ask for code help, suggestions, or explanations.");

        userInput = EditorGUILayout.TextField("Your Question:", userInput);

        if (GUILayout.Button("Ask AI"))
        {
            _ = QueryAI(userInput);
        }

        GUILayout.Label("AI Response:");
        scrollPos = EditorGUILayout.BeginScrollView(scrollPos, GUILayout.Height(100));
        EditorGUILayout.LabelField(aiResponse, EditorStyles.wordWrappedLabel);
        EditorGUILayout.EndScrollView();
    }

    async Task QueryAI(string prompt)
    {
        aiResponse = "Thinking...";
        Repaint();
        // TODO: Replace with your AI API call
        await Task.Delay(1000);
        aiResponse = "[AI response will appear here. Integrate with OpenAI or similar API.]";
        Repaint();
    }
}
