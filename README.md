# Meeting Times MCP App

A tiny [MCP App](https://modelcontextprotocol.io/docs/extensions/apps) that shows one meeting time across several time zones, as an interactive board you can open next to a chat.

This is the sample from the ProAI Clips video on building an MCP App and opening it in Claude. It follows the official [MCP Apps getting started](https://claude.com/docs/connectors/building/mcp-apps/getting-started) pattern and the [`ext-apps` quickstart](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/quickstart).

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

Claude needs a public HTTPS URL to add a local server as a custom connector. Anthropic's [testing docs](https://claude.com/docs/connectors/building/testing#test-a-local-server) recommend a Cloudflare Tunnel or ngrok.

1. Leave this server running on port 3001.
2. In another terminal, start a quick tunnel, for example:

   ```bash
   cloudflared tunnel --url http://localhost:3001
   ```

3. Copy the `trycloudflare.com` hostname (no `https://`) and restart the server with that host allowed. `createMcpExpressApp` only accepts `localhost` in the `Host` header unless you set `ALLOWED_HOSTS`:

   ```bash
   ALLOWED_HOSTS=your-subdomain.trycloudflare.com npm start
   ```

   If you prefer, start the tunnel first, then start the server with `ALLOWED_HOSTS` already set.

4. In Claude, add the connector at **Customize → Connectors → Add → Add custom connector**. Use the tunnel URL ending in `/mcp`, for example `https://your-subdomain.trycloudflare.com/mcp`. Keep the detected auth setting, or choose **No sign-in** if that is what the form shows for this sample. Then **Add**, and **Connect** if Claude shows that button.

Official steps: [Add a custom connector](https://claude.com/docs/connectors/custom/add-unlisted#add-a-connector-by-url). On Free, Pro, Max, and Ultra you add it from Customize. On Team and Enterprise, an Owner adds it in organization settings. On Free, you can have one custom connector.

The tunnel publishes your local server on the public internet. Keep it running only while you test, and do not put secrets in this project.

There is no staging environment. You test a custom connector in production, against your own Claude account.

## Environment

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default `3001`) |
| `ALLOWED_HOSTS` | Extra hostnames allowed in the `Host` header, comma-separated, with no scheme. Use this for a tunnel hostname. `localhost`, `127.0.0.1`, and `[::1]` are always allowed. |

Do not commit `.env` files or tunnel URLs.

## License

MIT. Copyright (c) 2026 ProAI Clips.
