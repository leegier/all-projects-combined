using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UnityEditor;
using UnityEngine;
using UnityEngine.Networking;

namespace Nightshade.Integrations.Unity
{
    public class NightshadeCommander : EditorWindow
    {
        private const string DefaultEndpoint = "http://localhost:8787/mcp";

        private string endpoint = DefaultEndpoint;
        private string selectedTool = "bulk_edit_assets";
        private string target = "WeaponAssets";
        private bool dryRun = true;
        private int variantCount = 3;
        private string constraintsCsv = "naming_conventions,balance_budget";
        private string customPayload = "{}";
        private readonly Dictionary<string, string> toolFields = new()
        {
            ["modifications"] = "{\"damage\":10}",
            ["variantTag"] = "Ludus",
            ["targetDps"] = "25",
            ["tolerance"] = "2",
            ["checks"] = "naming,collision,performance",
            ["scene"] = "AutonomousLevel",
            ["steps"] = "remove_empty_groups,rebuild_navigation"
        };

        private Vector2 scroll;
        private string responseText = "Press Send Command to view the response.";
        private string diffPreview = "Diff / log output will appear here.";
        private bool isSending;

        [MenuItem("Nightshade/Command Console")]
        public static void ShowWindow()
        {
            var window = GetWindow<NightshadeCommander>("Nightshade Console");
            window.minSize = new Vector2(420, 560);
        }

        private void OnGUI()
        {
            scroll = EditorGUILayout.BeginScrollView(scroll);

            EditorGUILayout.LabelField("Nightshade MCP Console", EditorStyles.boldLabel);
            EditorGUILayout.Space();

            endpoint = EditorGUILayout.TextField("MCP Endpoint", endpoint);
            EditorGUILayout.Space();

            DrawToolSelector();
            DrawToolFields();

            dryRun = EditorGUILayout.Toggle("Dry Run", dryRun);
            variantCount = EditorGUILayout.IntSlider("Variant Count", variantCount, 1, 12);
            constraintsCsv = EditorGUILayout.TextField("Constraints (CSV)", constraintsCsv);

            EditorGUILayout.Space();
            EditorGUILayout.LabelField("Custom Payload (JSON)", EditorStyles.miniLabel);
            customPayload = EditorGUILayout.TextArea(customPayload, GUILayout.Height(90));

            EditorGUI.BeginDisabledGroup(isSending);
            if (GUILayout.Button(isSending ? "Sending..." : "Send Command", GUILayout.Height(34)))
            {
                _ = SendNightshadeCommand();
            }
            EditorGUI.EndDisabledGroup();

            EditorGUILayout.Space();
            EditorGUILayout.LabelField("Response", EditorStyles.boldLabel);
            EditorGUILayout.TextArea(responseText, GUILayout.Height(140));
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("Diff / Logs", EditorStyles.boldLabel);
            EditorGUILayout.TextArea(diffPreview, GUILayout.Height(140));

            EditorGUILayout.EndScrollView();
        }

        private void DrawToolSelector()
        {
            var toolNames = new[] { "bulk_edit_assets", "generate_variants", "normalize_dps", "prefab_audit", "scene_refactor" };
            var toolDescriptions = new Dictionary<string, string>
            {
                ["bulk_edit_assets"] = "Apply batch modifications across assets with diff+log output.",
                ["generate_variants"] = "Spawn deterministic variants while obeying constraints.",
                ["normalize_dps"] = "Normalize DPS values with rollback-ready reports.",
                ["prefab_audit"] = "Audit prefab policy/compliance with timestamped logs.",
                ["scene_refactor"] = "Refactor scenes safely with undo-friendly steps."
            };

            var currentIndex = Array.IndexOf(toolNames, selectedTool);
            var newIndex = EditorGUILayout.Popup("Tool", currentIndex, toolNames);
            selectedTool = toolNames[newIndex];
            EditorGUILayout.LabelField(toolDescriptions[selectedTool], EditorStyles.helpBox);
        }

        private void DrawToolFields()
        {
            target = EditorGUILayout.TextField("Target / Scope", target);
            switch (selectedTool)
            {
                case "bulk_edit_assets":
                    toolFields["modifications"] = EditorGUILayout.TextField("Modifications (JSON)", toolFields["modifications"]);
                    break;
                case "generate_variants":
                    toolFields["variantTag"] = EditorGUILayout.TextField("Variant Tag", toolFields["variantTag"]);
                    break;
                case "normalize_dps":
                    toolFields["targetDps"] = EditorGUILayout.TextField("Target DPS", toolFields["targetDps"]);
                    toolFields["tolerance"] = EditorGUILayout.TextField("Tolerance", toolFields["tolerance"]);
                    break;
                case "prefab_audit":
                    toolFields["checks"] = EditorGUILayout.TextField("Checks (CSV)", toolFields["checks"]);
                    break;
                case "scene_refactor":
                    toolFields["scene"] = EditorGUILayout.TextField("Scene / Level", toolFields["scene"]);
                    toolFields["steps"] = EditorGUILayout.TextField("Steps (CSV)", toolFields["steps"]);
                    break;
            }
        }

        private async Task SendNightshadeCommand()
        {
            isSending = true;
            try
            {
                var payload = BuildToolArguments();
                var requestBody = BuildCallRequest(payload);
                var rawResponse = await PostJson(endpoint, requestBody);
                responseText = rawResponse;
                ParseStructuredContent(rawResponse);
            }
            catch (Exception ex)
            {
                responseText = $"Error: {ex.Message}";
                diffPreview = "No structured content available due to failure.";
            }
            finally
            {
                isSending = false;
                Repaint();
            }
        }

        private string BuildToolArguments()
        {
            var builder = new StringBuilder();
            builder.Append("{");
            builder.Append($"\"target\":\"{target}\",");

            switch (selectedTool)
            {
                case "bulk_edit_assets":
                    builder.Append("\"command\":\"bulk_edit\",");
                    builder.Append($"\"modifications\":{toolFields["modifications"]},");
                    break;
                case "generate_variants":
                    builder.Append("\"command\":\"generate_variants\",");
                    builder.Append($"\"variant_tag\":\"{toolFields["variantTag"]}\",");
                    builder.Append($"\"count\":{variantCount},");
                    break;
                case "normalize_dps":
                    builder.Append("\"command\":\"normalize_dps\",");
                    builder.Append($"\"target_dps\":{toolFields["targetDps"]},");
                    builder.Append($"\"tolerance\":{toolFields["tolerance"]},");
                    break;
                case "prefab_audit":
                    builder.Append("\"command\":\"prefab_audit\",");
                    builder.Append($"\"checks\":[{string.Join(",", ParseCsv(toolFields["checks"]))}],");
                    break;
                case "scene_refactor":
                    builder.Append("\"command\":\"scene_refactor\",");
                    builder.Append($"\"scene\":\"{toolFields["scene"]}\",");
                    builder.Append($"\"steps\":[{string.Join(",", ParseCsv(toolFields["steps"]))}],");
                    break;
            }

            builder.Append($"\"dry_run\":{dryRun.ToString().ToLower()},");
            builder.Append($"\"constraints\":[{string.Join(",", ParseCsv(constraintsCsv))}],");
            builder.Append($"\"custom\":{customPayload}");
            builder.Append("}");

            return builder.ToString();
        }

        private static IEnumerable<string> ParseCsv(string csv)
        {
            return csv.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(value => $"\"{value.Trim()}\"");
        }

        private string BuildCallRequest(string payloadJson)
        {
            return $"{{\"jsonrpc\":\"2.0\",\"id\":\"{Guid.NewGuid():N}\",\"method\":\"tools/call\",\"params\":{{\"name\":\"{selectedTool}\",\"arguments\":{payloadJson}}}}}";
        }

        private async Task<string> PostJson(string url, string body)
        {
            var request = new UnityWebRequest(url, UnityWebRequest.kHttpVerbPOST)
            {
                uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body)),
                downloadHandler = new DownloadHandlerBuffer()
            };
            request.SetRequestHeader("Content-Type", "application/json");
            var tcs = new TaskCompletionSource<string>();

            var operation = request.SendWebRequest();
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
                request.Dispose();
            };

            return await tcs.Task;
        }

        private void ParseStructuredContent(string rawJson)
        {
            try
            {
                var rpc = JsonUtility.FromJson<RpcResponse>(rawJson);
                if (rpc?.result?.structuredContent == null)
                {
                    diffPreview = "Structured content missing.";
                    return;
                }

                var structured = rpc.result.structuredContent;
                var builder = new StringBuilder();
                builder.AppendLine($"Status: {structured.status}");
                builder.AppendLine("Diff:");
                foreach (var diff in structured.diff ?? Array.Empty<string>())
                {
                    builder.AppendLine($"  - {diff}");
                }

                builder.AppendLine("Affected Assets:");
                foreach (var affected in structured.affectedAssets ?? Array.Empty<string>())
                {
                    builder.AppendLine($"  - {affected}");
                }

                builder.AppendLine("Logs:");
                foreach (var log in structured.logs ?? Array.Empty<string>())
                {
                    builder.AppendLine($"  - {log}");
                }

                diffPreview = builder.ToString();
            }
            catch (Exception ex)
            {
                diffPreview = $"Failed to parse structured output: {ex.Message}";
            }
        }

        [Serializable]
        private class RpcResponse
        {
            public CallResult result;
        }

        [Serializable]
        private class CallResult
        {
            public AuditResult structuredContent;
        }

        [Serializable]
        private class AuditResult
        {
            public string status;
            public string[] diff;
            public string[] affectedAssets;
            public string[] logs;
        }
    }
}
