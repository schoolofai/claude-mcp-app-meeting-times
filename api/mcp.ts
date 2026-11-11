import type { IncomingMessage, ServerResponse } from "node:http";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { createServer } from "../server.js";

/**
 * Stateless streamable-HTTP MCP endpoint for Vercel.
 * Each request creates a fresh server and transport so no session
 * state is kept between invocations. Rewritten from /mcp via vercel.json.
 */

type VercelRequest = IncomingMessage & { body?: unknown };

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID, Authorization",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

function writeJsonRpcError(
  res: ServerResponse,
  status: number,
  code: number,
  message: string,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  setCorsHeaders(res);
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code, message },
      id: null,
    }),
  );
}

export default async function handler(
  req: VercelRequest,
  res: ServerResponse,
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    setCorsHeaders(res);
    res.end();
    return;
  }

  const server = createServer();
  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  setCorsHeaders(res);

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP error:", error);
    if (!res.headersSent) {
      writeJsonRpcError(res, 500, -32603, "Internal server error");
    }
  }
}
