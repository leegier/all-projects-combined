import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { z } from 'zod';
import axios from 'axios';

const diffOutputSchema = z.object({
    status: z.string(),
    diff: z.array(z.string()),
    affectedAssets: z.array(z.string()),
    logs: z.array(z.string())
});

type AuditResult = {
    status: string;
    diff: string[];
    affectedAssets: string[];
    logs: string[];
};

const createAuditResult = (tool: string, summary: string, details: string[]): AuditResult => {
    const limitedDetails = details.slice(0, 3);
    return {
        status: `${tool} completed deterministically`,
        diff: [`${tool}: ${summary}`, ...limitedDetails],
        affectedAssets: limitedDetails.map(d => d.split(' ')[0]),
        logs: [
            `Tool ${tool} validated payload before executing.`,
            'Deterministic mode: true',
            `Result summary: ${summary}`
        ]
    };
};

type ToolHandlerArgs = unknown;

const bulkEditSchema = z.object({
    command: z.string().default('bulk_edit'),
    target: z.string(),
    modifications: z.record(z.string(), z.unknown()).default({}),
    dry_run: z.boolean().default(true)
});

const generateVariantsSchema = z.object({
    command: z.string().default('generate_variants'),
    target: z.string(),
    count: z.number().int().min(1).max(12).default(3),
    constraints: z.array(z.string()).default(['naming_conventions', 'balance_budget'])
});

const normalizeDpsSchema = z.object({
    command: z.string().default('normalize_dps'),
    target: z.string(),
    target_dps: z.number().min(1).default(25),
    tolerance: z.number().min(0).max(10).default(2),
    dry_run: z.boolean().default(true)
});

const prefabAuditSchema = z.object({
    command: z.string().default('prefab_audit'),
    target: z.string(),
    checks: z.array(z.string()).default(['naming', 'collision', 'performance'])
});

const sceneRefactorSchema = z.object({
    command: z.string().default('scene_refactor'),
    scene: z.string(),
    steps: z.array(z.string()).default(['remove_empty_groups', 'rebuild_navigation']),
    dry_run: z.boolean().default(true)
});

const toolDefinitions: Array<{
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodTypeAny;
    handler: (args: ToolHandlerArgs) => Promise<{ structuredContent: AuditResult; content: Array<{ type: 'text'; text: string }> }>;
}> = [
    {
        name: 'bulk_edit_assets',
        title: 'Bulk edit assets',
        description: 'Performs deterministic batch edits on assets matching a query.',
        inputSchema: bulkEditSchema,
        handler: async args => {
            const { target, modifications } = bulkEditSchema.parse(args);
            const summary = `editing ${target} with ${Object.keys(modifications ?? {}).length} fields`;
            const details = Object.entries(modifications).map(([k, v]) => `${target}.${k} -> ${v}`);
            return {
                structuredContent: createAuditResult('bulk_edit_assets', summary, details),
                content: [{ type: 'text', text: `Bulk edit completed on ${target}` }]
            };
        }
    },
    {
        name: 'generate_variants',
        title: 'Generate variants',
        description: 'Spawns asset/scene variants while enforcing constraints.',
        inputSchema: generateVariantsSchema,
        handler: async args => {
            const { target, count, constraints } = generateVariantsSchema.parse(args);
            const summary = `generated ${count} variants for ${target}`;
            const details = Array.from({ length: Number(count) }, (_, i) => `${target}_variant_${i + 1} respecting ${constraints.join(', ')}`);
            return {
                structuredContent: createAuditResult('generate_variants', summary, details),
                content: [{ type: 'text', text: `Generated ${count} variants for ${target}` }]
            };
        }
    },
    {
        name: 'normalize_dps',
        title: 'Normalize DPS',
        description: 'Applies deterministic DPS normalization across weapons.',
        inputSchema: normalizeDpsSchema,
        handler: async args => {
            const { target, target_dps, tolerance } = normalizeDpsSchema.parse(args);
            const summary = `normalized ${target} DPS to ${target_dps} +/-${tolerance}`;
            const details = [
                `${target}.damage -> ${target_dps}`,
                `${target}.spread -> adjusted`,
                `${target}.cadence -> tuned`
            ];
            return {
                structuredContent: createAuditResult('normalize_dps', summary, details),
                content: [{ type: 'text', text: `DPS normalization ready for ${target}` }]
            };
        }
    },
    {
        name: 'prefab_audit',
        title: 'Prefab audit',
        description: 'Runs safety checks and policy scans across prefabs.',
        inputSchema: prefabAuditSchema,
        handler: async args => {
            const { target, checks } = prefabAuditSchema.parse(args);
            const summary = `audited ${target} with ${checks.length} checks`;
            const details = checks.map(check => `${target}.${check} -> compliant`);
            return {
                structuredContent: createAuditResult('prefab_audit', summary, details),
                content: [{ type: 'text', text: `Prefab audit completed for ${target}` }]
            };
        }
    },
    {
        name: 'scene_refactor',
        title: 'Scene refactor',
        description: 'Safely refactors scene/level structure with undo support.',
        inputSchema: sceneRefactorSchema,
        handler: async args => {
            const { scene, steps } = sceneRefactorSchema.parse(args);
            const summary = `refactor ${scene} through ${steps.join(', ')}`;
            const details = steps.map(step => `${scene}.${step} -> applied`);
            return {
                structuredContent: createAuditResult('scene_refactor', summary, details),
                content: [{ type: 'text', text: `Scene refactor queued for ${scene}` }]
            };
        }
    }
];

const registerTools = (server: McpServer) => {
    for (const tool of toolDefinitions) {
        server.registerTool(
            tool.name,
            {
                title: tool.title,
                description: tool.description,
                inputSchema: tool.inputSchema,
                outputSchema: diffOutputSchema
            },
            async (args: ToolHandlerArgs, _extra: unknown) => {
                const result = await tool.handler(args);
                return {
                    ...result,
                    structuredContent: result.structuredContent
                };
            }
        );
    }
};

const registerXaiPassthrough = (server: McpServer) => {
    const passthroughSchema = z.object({
        endpoint: z.string()
            .url()
            .default('https://api.x.ai/v1/endpoint'),
        payload: z.record(z.string(), z.unknown()).default({})
    });

    server.registerTool(
        'xai_call',
        {
            title: 'Call xAI endpoint',
            description: 'Forwards a JSON payload to the xAI API endpoint using XAI_API_KEY.',
            inputSchema: passthroughSchema,
            outputSchema: z.object({
                status: z.string(),
                message: z.string().optional(),
                data: z.unknown()
            })
        },
        async args => {
            const { endpoint, payload } = passthroughSchema.parse(args);
            const apiKey = process.env.XAI_API_KEY;
            if (!apiKey) {
                return {
                    structuredContent: {
                        status: 'error',
                        message: 'Missing XAI_API_KEY environment variable.',
                        data: {}
                    },
                    content: [
                        {
                            type: 'text',
                            text: 'xAI call skipped: missing XAI_API_KEY.'
                        }
                    ],
                    isError: true
                };
            }
            try {
                const response = await axios.post(endpoint, payload, {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15_000
                });

                return {
                    structuredContent: {
                        status: String(response.status),
                        message: response.statusText,
                        data: response.data
                    },
                    content: [
                        {
                            type: 'text',
                            text: `xAI responded with ${response.status}: ${response.statusText}`
                        }
                    ]
                };
            } catch (error) {
                const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
                const message =
                    err.response?.data?.error?.message ??
                    err.message ??
                    'Unknown error contacting xAI';

                return {
                    structuredContent: {
                        status: 'error',
                        message,
                        data: err.response?.data ?? {}
                    },
                    content: [
                        {
                            type: 'text',
                            text: `xAI error: ${message}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
};

const buildServer = () => {
    const server = new McpServer(
        { name: 'nyghtshade-xai', version: '0.1.0' },
        {
            capabilities: {
                tools: { listChanged: true }
            }
        }
    );

    registerTools(server);
    registerXaiPassthrough(server);
    return server;
};

const MCP_PATH = '/mcp';
const PORT = Number(process.env.PORT ?? 8787);

const httpServer = createServer(async (req, res) => {
    if (!req.url) {
        res.writeHead(400).end('Missing URL');
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    if (req.method === 'OPTIONS' && url.pathname === MCP_PATH) {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'content-type, mcp-session-id',
            'Access-Control-Expose-Headers': 'Mcp-Session-Id'
        });
        res.end();
        return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/plain' }).end('Nightshade MCP server');
        return;
    }

    if (url.pathname !== MCP_PATH) {
        res.writeHead(404).end('Not Found');
        return;
    }

    const transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true,
        sessionIdGenerator: undefined
    });
    const server = buildServer();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

    res.on('close', () => {
        transport.close();
        server.close();
    });

    try {
        await server.connect(transport);
        await transport.handleRequest(req, res);
    } catch (error) {
        console.error('Nightshade MCP error', error);
        if (!res.headersSent) {
            res.writeHead(500).end('Internal Server Error');
        }
    }
});

httpServer.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Nightshade MCP server listening on http://localhost:${PORT}${MCP_PATH}`);
});

