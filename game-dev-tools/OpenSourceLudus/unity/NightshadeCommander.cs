using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using UnityEditor;
using UnityEngine;
using UnityEngine.Networking;

namespace OpenSourceLudus.Unity
{
    public class NightshadeCommander : EditorWindow
    {
        private const string DefaultEndpoint = "http://localhost:8787/mcp";

        private string endpoint = DefaultEndpoint;
        private string toolName = "bulk_edit_assets";
        private string target = "WeaponAssets";
        private bool dryRun = true;
        private int variantCount = 3;
        private string constraintsCsv = "naming_conventions,balance_budget";
        private string modificationsCsv = "damage=42,range=120";
        private string sceneName = "Arena";
        private string stepsCsv = "remove_empty_groups,rebuild_navigation";
        private string responseText = "Press Send Command to view the response.";
        private bool isSending;
        private Vector2 scroll;

        [MenuItem("Ludus/Nightshade Console")]
        public static void ShowWindow()
        {
            var window = GetWindow<NightshadeCommander>("Nightshade Console");
            window.minSize = new Vector2(420, 560);
        }

        private void OnGUI()
        {
            scroll = EditorGUILayout.BeginScrollView(scroll);

            EditorGUILayout.LabelField("Ludus MCP Console", EditorStyles.boldLabel);
            EditorGUILayout.Space();

            endpoint = EditorGUILayout.TextField("MCP Endpoint", endpoint);
            toolName = EditorGUILayout.TextField("Tool", toolName);
            target = EditorGUILayout.TextField("Target", target);
            dryRun = EditorGUILayout.Toggle("Dry Run", dryRun);
            variantCount = EditorGUILayout.IntSlider("Variant Count", variantCount, 1, 12);
            constraintsCsv = EditorGUILayout.TextField("Constraints (CSV)", constraintsCsv);
            modificationsCsv = EditorGUILayout.TextField("Modifications (key=value CSV)", modificationsCsv);
            sceneName = EditorGUILayout.TextField("Scene", sceneName);
            stepsCsv = EditorGUILayout.TextField("Scene Steps (CSV)", stepsCsv);

            EditorGUILayout.Space();
            EditorGUI.BeginDisabledGroup(isSending);
            if (GUILayout.Button(isSending ? "Sending…" : "Send Command", GUILayout.Height(34)))
            {
                _ = SendNightshadeCommand();
            }
            EditorGUI.EndDisabledGroup();

            EditorGUILayout.Space();
            EditorGUILayout.LabelField("Response", EditorStyles.boldLabel);
            EditorGUILayout.TextArea(responseText, GUILayout.Height(200));

            EditorGUILayout.EndScrollView();
        }

        private async Task SendNightshadeCommand()
        {
            isSending = true;
            try
            {
                var arguments = BuildArguments();
                var requestBody = BuildCallRequest(toolName, arguments);
                responseText = await PostJson(endpoint, requestBody);
            }
            catch (Exception ex)
            {
                responseText = $"Error: {ex.Message}";
            }
            finally
            {
                isSending = false;
                Repaint();
            }
        }

        private Dictionary<string, object> BuildArguments()
        {
            var constraints = SplitCsv(constraintsCsv);
            var steps = SplitCsv(stepsCsv);

            return new Dictionary<string, object>
            {
                { "command", toolName },
                { "target", target },
                { "modifications", ParseKeyValueCsv(modificationsCsv) },
                { "dry_run", dryRun },
                { "count", variantCount },
                { "constraints", constraints },
                { "scene", sceneName },
                { "steps", steps }
            };
        }

        private static List<string> SplitCsv(string csv)
        {
            var results = new List<string>();
            if (string.IsNullOrWhiteSpace(csv))
            {
                return results;
            }

            foreach (var entry in csv.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
            {
                var trimmed = entry.Trim();
                if (!string.IsNullOrEmpty(trimmed))
                {
                    results.Add(trimmed);
                }
            }

            return results;
        }

        private static Dictionary<string, object> ParseKeyValueCsv(string csv)
        {
            var result = new Dictionary<string, object>();
            if (string.IsNullOrWhiteSpace(csv))
            {
                return result;
            }

            foreach (var entry in csv.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
            {
                var pair = entry.Split(new[] { '=' }, 2, StringSplitOptions.RemoveEmptyEntries);
                if (pair.Length != 2)
                {
                    continue;
                }

                var key = pair[0].Trim();
                var value = pair[1].Trim();
                if (!string.IsNullOrEmpty(key))
                {
                    result[key] = value;
                }
            }

            return result;
        }

        private static string BuildCallRequest(string tool, Dictionary<string, object> arguments)
        {
            var payload = new RpcPayload
            {
                jsonrpc = "2.0",
                id = Guid.NewGuid().ToString("N"),
                method = "tools/call",
                @params = new RpcParams
                {
                    name = tool,
                    arguments = arguments
                }
            };

            return JsonUtility.ToJson(payload);
        }

        private async Task<string> PostJson(string url, string body)
        {
            using (var request = new UnityWebRequest(url, UnityWebRequest.kHttpVerbPOST))
            {
                request.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body));
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Content-Type", "application/json");

                var operation = request.SendWebRequest();
                var tcs = new TaskCompletionSource<string>();
                operation.completed += _ =>
                {
                    if (request.result == UnityWebRequest.Result.Success)
                    {
                        tcs.SetResult(request.downloadHandler.text);
                    }
                    else
                    {
                        var errorMessage = request.error ?? "Unknown UnityWebRequest error";
                        tcs.SetException(new InvalidOperationException(errorMessage));
                    }
                };

                return await tcs.Task;
            }
        }

        [Serializable]
        private class RpcPayload
        {
            public string jsonrpc;
            public string id;
            public string method;
            public RpcParams @params;
        }

        [Serializable]
        private class RpcParams
        {
            public string name;
            public Dictionary<string, object> arguments;
        }
    }
}
