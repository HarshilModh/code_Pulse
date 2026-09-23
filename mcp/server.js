#!/usr/bin/env node
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import crypto from 'crypto';
import prisma from '../api/lib/prisma.js';
import { mcpTools, executeTool } from './tools.js';

const buildServer = () => {
    const server = new Server(
        {name:"code_Pulse",version:"1.0.0"},
       { capabilities: { tools: {} } },
    );
     // Return the full tool list to the MCP client
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools }));

    // Execute a tool and return the result as text content
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
      const { name, arguments: args } = req.params;
      try {
        const result = await executeTool(name, args ?? {});
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    });

    return server;
}

if (process.argv[2] === '--http') {
    // HTTP/SSE transport — used when deployed on Render
    const app = express();
    const port = process.env.MCP_PORT ?? 3002;

    // Look up the raw key against stored SHA-256 hashes; update lastUsedAt on success.
    // Skip auth entirely in local dev (no DB connection required).
    async function authenticate(req, res, next) {
      if (process.env.NODE_ENV !== 'production') return next();
      const raw = req.headers['x-codepulse-key'];
      if (!raw) return res.status(401).json({ error: 'Missing X-Codepulse-Key header' });
      const hashed = crypto.createHash('sha256').update(raw).digest('hex');
      const apiKey = await prisma.apiKey.findUnique({ where: { key: hashed } });
      if (!apiKey) return res.status(401).json({ error: 'Invalid API key' });
      // fire-and-forget — don't block the request on this update
      prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      req.userId = apiKey.userId;
      next();
    }

    app.use(authenticate);

    const transports = {}; // sessionId → SSEServerTransport

    app.get('/sse', async (req, res) => {
      const transport = new SSEServerTransport('/messages', res);
      transports[transport.sessionId] = transport;
      const server = buildServer();
      await server.connect(transport);
      res.on('close', () => delete transports[transport.sessionId]);
    });

    app.post('/messages', express.json(), async (req, res) => {
      const transport = transports[req.query.sessionId];
      if (!transport) return res.status(404).json({ error: 'Session not found' });
      await transport.handlePostMessage(req, res, req.body);
    });

    app.get('/health', (_req, res) => res.json({ ok: true }));
    app.listen(port, () => console.error(`[mcp] HTTP server on port ${port}`));

  } else {
    // stdio transport — used by Claude Desktop / npx codepulse-mcp
    const server = buildServer();
    await server.connect(new StdioServerTransport());
  }