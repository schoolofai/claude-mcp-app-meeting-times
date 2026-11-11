# Meeting Times MCP App

A tiny [MCP App](https://modelcontextprotocol.io/docs/extensions/apps) that shows one meeting time across several time zones, as an interactive board that opens in the chat.

This is the sample from the ProAI Clips video on building an MCP App and opening it in Claude. It follows the official [MCP Apps getting started](https://claude.com/docs/connectors/building/mcp-apps/getting-started) pattern and the [`ext-apps` quickstart](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/quickstart).

Watch the video: [https://youtu.be/wUDbsUiiMVE](https://youtu.be/wUDbsUiiMVE)

There are no API keys. Time zones use the IANA names your runtime already knows, through `Intl.DateTimeFormat`.

## What it does

The tool is `show-meeting-times`. You pass:

- `when` — a date and time in ISO-8601, for example `2026-11-11T15:00`
- `from_zone` — the IANA zone for that clock time (default `Europe/London`)
- `zones` — optional list of IANA zones to show

If `when` has no offset, it is read as a clock time in `from_zone`, not as UTC. So 3pm in London stays 3pm in London, including when Britain is on summer time.

The default board shows London, New York, San Francisco, Berlin, and Tokyo. The view lists each city's local time and date. You can type a new time in the view and ask the server to refresh the board.

A prompt that works in a host or in Claude:

> Show me 3pm London on 11 November 2026 in New York, San Francisco and Tokyo.

That is 15:00 in London, 10:00 in New York, 07:00 in San Francisco, and 00:00 in Tokyo on the next calendar day (Thursday 12 November). Change When to `2026-11-11T18:00` and update the board once, and the same cities show 18:00, 13:00, 10:00, 19:00 in Berlin, and 03:00 in Tokyo.

## Stack

- Node.js 20 or newer
- TypeScript
- Vite (the view is bundled into a single HTML file)
- Express, with `@modelcontextprotocol/express` (`createMcpExpressApp`)
- `@modelcontextprotocol/ext-apps`, `@modelcontextprotocol/server` 2.x, and `@modelcontextprotocol/node` 2.x
- Zod for the tool input schema

## Quick start

```bash
git clone https://github.com/schoolofai/claude-mcp-app-meeting-times
cd claude-mcp-app-meeting-times
npm install
npm start
```

The MCP endpoint is `http://localhost:3001/mcp`. `npm start` rebuilds the view as you edit it. For a one-shot production build:

```bash
npm run start:prod
```

### Try it in the official local host

The MCP Apps repo ships a basic host that opens the app in a browser, without signing in to Claude.

```bash
git clone https://github.com/modelcontextprotocol/ext-apps
cd ext-apps/examples/basic-host
npm install
SERVERS='["http://localhost:3001/mcp"]' npm start
```

Open [http://localhost:8080](http://localhost:8080). Call `show-meeting-times`, or send the prompt above if the host lets you chat.

You can also list tools with the official inspector:

```bash
npx @modelcontextprotocol/inspector --cli http://localhost:3001/mcp --transport http --method tools/list
```

### Try it in Claude as a custom connector

Claude needs a public HTTPS URL, because it reaches your server from Anthropic's infrastructure. The ProAI Clips video uses a Vercel Function deploy of this same app, not a tunnel in front of a local process.

#### Deploy to Vercel

This is the path the ProAI Clips video uses. The Function in `api/mcp.ts` serves streamable HTTP, stays stateless per request, and returns the same bundled `ui://` view. `vercel.json` rewrites `/mcp` to that Function. The production build (`npm run build`) bundles the view HTML before the Function is packaged.

To deploy your own copy, publish this repo to your own Vercel project. The connector URL will be `https://your-project.vercel.app/mcp`. If Deployment Protection blocks Claude, disable it only for that project. Do not put secrets in the project.

You can check a deployed URL with:

```bash
npx @modelcontextprotocol/inspector --cli https://your-project.vercel.app/mcp --transport http --method tools/list
```

Official [testing docs](https://claude.com/docs/connectors/building/testing#test-a-local-server) also describe a Cloudflare Tunnel or ngrok in front of a local server. That is a documented alternative, not the path this video uses.

#### Add it in Claude

Official steps: [Add a custom connector](https://claude.com/docs/connectors/custom/add-unlisted#add-a-connector-by-url).

1. In Claude, go to **Customize → Connectors → Add custom connector**.
2. Name the connector, for example `Meeting times`.
3. Remote MCP server URL: your public HTTPS URL ending in `/mcp`, for example `https://your-project.vercel.app/mcp`.
4. Click **Continue**. Claude detects **No sign-in**; keep that. This sample does not use OAuth or an API key.
5. Click **Add**, then **Connect**.
6. Start a new chat. Turn the connector on from the chat's **+ → Connectors**, then type the prompt. Claude calls `show-meeting-times`, and the board opens in the chat, not in a side panel.

On Free, Pro, Max, and Ultra you add it from Customize. On the Free plan, you can have one custom connector. On Team and Enterprise, an Owner adds it in organization settings, and each member then connects with their own account.

There is no staging environment. You test a custom connector in production, against your own Claude account. Do not put secrets in this project.

## Environment

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default `3001`) |
| `ALLOWED_HOSTS` | Extra hostnames allowed in the `Host` header, comma-separated, with no scheme. Needed if you front the local Express server with another hostname. `localhost`, `127.0.0.1`, and `[::1]` are always allowed. A Vercel Function deploy does not use this variable. |

Do not commit `.env` files or tunnel URLs.

## License

MIT. Copyright (c) 2026 ProAI Clips.
