/**
 * Local test of the Vercel Function handler (api/mcp.ts).
 * Starts a short-lived Node HTTP server and runs initialize, tools/list,
 * tools/call (show-meeting-times), and resources/read on the ui:// resource.
 */
import http from "node:http";
import handler from "../api/mcp.js";

const PORT = Number(process.env.TEST_PORT ?? "3011");

type RpcResult = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: unknown;
  raw: string;
};

async function rpc(method: string, params?: unknown, id: number | string = 1): Promise<RpcResult> {
  const payload: Record<string, unknown> = {
    jsonrpc: "2.0",
    id,
    method,
  };
  if (params !== undefined) payload.params = params;
  const res = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  let body: unknown = raw;
  try {
    body = JSON.parse(raw);
  } catch {
    // SSE or empty
  }
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body, raw };
}

function fail(label: string, result: RpcResult, extra?: string): never {
  console.error(`FAIL ${label}`);
  console.error("status", result.status);
  console.error("body", typeof result.body === "string" ? result.raw.slice(0, 500) : JSON.stringify(result.body, null, 2));
  if (extra) console.error(extra);
  process.exit(1);
}

async function main() {
  const server = http.createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve());
  });
  console.log(`local function handler listening on http://127.0.0.1:${PORT}/mcp`);

  try {
    const init = await rpc("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "local-vercel-handler-test", version: "0.1.0" },
    });
    if (init.status !== 200) fail("initialize status", init);
    const initBody = init.body as { result?: { protocolVersion?: string; serverInfo?: { name?: string } }; error?: unknown };
    if (!initBody?.result?.protocolVersion) fail("initialize result", init);
    console.log("OK initialize", initBody.result.protocolVersion, initBody.result.serverInfo?.name);

    const listed = await rpc("tools/list", {});
    if (listed.status !== 200) fail("tools/list status", listed);
    const tools = (listed.body as { result?: { tools?: { name: string }[] } })?.result?.tools ?? [];
    const names = tools.map((t) => t.name);
    if (!names.includes("show-meeting-times")) fail("tools/list missing tool", listed, `got ${names.join(",")}`);
    console.log("OK tools/list", names.join(", "));

    const call = await rpc("tools/call", {
      name: "show-meeting-times",
      arguments: {
        when: "2026-11-11T15:00",
        from_zone: "Europe/London",
        zones: ["America/New_York", "America/Los_Angeles", "Asia/Tokyo"],
      },
    });
    if (call.status !== 200) fail("tools/call status", call);
    const callBody = call.body as {
      result?: { content?: { type: string; text?: string }[]; isError?: boolean };
      error?: unknown;
    };
    if (callBody.error || callBody.result?.isError) fail("tools/call error", call);
    const text = callBody.result?.content?.find((c) => c.type === "text")?.text ?? "";
    const board = JSON.parse(text) as {
      rows: { label: string; time: string; date: string }[];
    };
    const byLabel = Object.fromEntries(board.rows.map((r) => [r.label, r]));
    const expect: Record<string, { time: string; dateIncludes?: string }> = {
      London: { time: "15:00" },
      "New York": { time: "10:00" },
      "San Francisco": { time: "07:00" },
      Tokyo: { time: "00:00", dateIncludes: "12 Nov" },
    };
    for (const [label, want] of Object.entries(expect)) {
      const row = byLabel[label];
      if (!row) fail(`tools/call missing ${label}`, call);
      if (row.time !== want.time) fail(`tools/call ${label} time ${row.time}`, call);
      if (want.dateIncludes && !row.date.includes(want.dateIncludes) && !row.date.includes("12")) {
        fail(`tools/call ${label} date ${row.date}`, call);
      }
    }
    console.log(
      "OK tools/call",
      board.rows.map((r) => `${r.label} ${r.time} ${r.date}`).join(" | "),
    );

    const resource = await rpc("resources/read", {
      uri: "ui://show-meeting-times/mcp-app.html",
    });
    if (resource.status !== 200) fail("resources/read status", resource);
    const contents = (resource.body as {
      result?: { contents?: { uri: string; mimeType?: string; text?: string }[] };
    })?.result?.contents ?? [];
    const html = contents[0]?.text ?? "";
    if (!html.includes("<html") && !html.includes("<!DOCTYPE") && !html.includes("<div")) {
      fail("resources/read html missing", resource, `len=${html.length}`);
    }
    if (html.length < 100) fail("resources/read html too short", resource, `len=${html.length}`);
    console.log(
      "OK resources/read",
      contents[0]?.uri,
      contents[0]?.mimeType,
      `html ${html.length} bytes`,
    );

    console.log("LOCAL_HANDLER_OK");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
