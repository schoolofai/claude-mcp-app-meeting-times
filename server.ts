import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/server";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const DIST_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "dist",
);

export const DEFAULT_ZONES = [
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Berlin",
  "Asia/Tokyo",
] as const;

const CITY_LABEL: Record<string, string> = {
  "Europe/London": "London",
  "America/New_York": "New York",
  "America/Los_Angeles": "San Francisco",
  "America/Chicago": "Chicago",
  "America/Denver": "Denver",
  "Europe/Berlin": "Berlin",
  "Europe/Paris": "Paris",
  "Europe/Madrid": "Madrid",
  "Asia/Tokyo": "Tokyo",
  "Asia/Singapore": "Singapore",
  "Asia/Kolkata": "Kolkata",
  "Australia/Sydney": "Sydney",
  UTC: "UTC",
};

export type ZoneRow = {
  zone: string;
  label: string;
  date: string;
  time: string;
  offset: string;
  weekday: string;
};

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a meeting time in `fromZone`. Accepts ISO-8601 (`2026-11-11T15:00`)
 * or the same with a trailing zone offset. A value with no offset is read
 * as a clock time in `fromZone`, not as UTC.
 */
export function parseMeetingTime(when: string, fromZone: string): Date {
  const trimmed = when.trim();
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`Could not parse date-time: ${when}`);
    }
    return d;
  }
  const m = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!m) {
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) {
      throw new Error(
        `Could not parse date-time: ${when}. Use ISO-8601, for example 2026-11-11T15:00.`,
      );
    }
    return d;
  }
  const [, ys, mos, ds, hs, mis, ss] = m;
  // Interpret the clock time in fromZone by formatting a UTC guess and
  // nudging until the zoned clock matches.
  const want = {
    year: Number(ys),
    month: Number(mos),
    day: Number(ds),
    hour: Number(hs),
    minute: Number(mis),
    second: Number(ss ?? 0),
  };
  let utc = Date.UTC(
    want.year,
    want.month - 1,
    want.day,
    want.hour,
    want.minute,
    want.second,
  );
  for (let i = 0; i < 3; i++) {
    const parts = zonedParts(new Date(utc), fromZone);
    const deltaMin =
      (((want.year - parts.year) * 12 + (want.month - parts.month)) * 32 +
        (want.day - parts.day)) *
        24 *
        60 +
      (want.hour - parts.hour) * 60 +
      (want.minute - parts.minute);
    const deltaSec = deltaMin * 60 + (want.second - parts.second);
    if (deltaSec === 0) break;
    utc += deltaSec * 1000;
  }
  return new Date(utc);
}

function zonedParts(date: Date, zone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") bag[p.type] = p.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

export function formatZone(date: Date, zone: string): ZoneRow {
  const dateFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const offsetFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    timeZoneName: "shortOffset",
  });
  const offset =
    offsetFmt.formatToParts(date).find((p) => p.type === "timeZoneName")
      ?.value ?? "";
  return {
    zone,
    label: CITY_LABEL[zone] ?? zone.replace(/_/g, " ").split("/").pop() ?? zone,
    date: dateFmt.format(date),
    time: timeFmt.format(date),
    offset,
    weekday: new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "long",
    }).format(date),
  };
}

export function buildBoard(
  when: string,
  fromZone: string,
  zones: string[],
): { instant: string; from_zone: string; rows: ZoneRow[] } {
  if (!isValidTimeZone(fromZone)) {
    throw new Error(`Unknown time zone: ${fromZone}`);
  }
  const seen = new Set<string>();
  const list: string[] = [];
  for (const z of [fromZone, ...zones]) {
    if (!z || seen.has(z)) continue;
    if (!isValidTimeZone(z)) {
      throw new Error(`Unknown time zone: ${z}`);
    }
    seen.add(z);
    list.push(z);
  }
  const instant = parseMeetingTime(when, fromZone);
  return {
    instant: instant.toISOString(),
    from_zone: fromZone,
    rows: list.map((z) => formatZone(instant, z)),
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Meeting Times MCP App",
    version: "0.1.0",
  });

  const resourceUri = "ui://show-meeting-times/mcp-app.html";

  registerAppTool(
    server,
    "show-meeting-times",
    {
      title: "Show meeting times",
      description:
        "Show a meeting time across time zones as an interactive board. Use this when someone asks what time a meeting is in other cities, or to compare time zones. Pass the meeting clock time in from_zone as ISO-8601, for example 2026-11-11T15:00.",
      inputSchema: z.object({
        when: z
          .string()
          .describe(
            "Meeting date and time as ISO-8601, for example 2026-11-11T15:00. If there is no offset, it is read as a clock time in from_zone.",
          ),
        from_zone: z
          .string()
          .default("Europe/London")
          .describe(
            "IANA time zone for 'when', for example Europe/London or America/New_York.",
          ),
        zones: z
          .array(z.string())
          .optional()
          .describe(
            "IANA time zones to show on the board. Defaults to London, New York, San Francisco, Berlin, and Tokyo.",
          ),
      }),
      _meta: { ui: { resourceUri } },
    },
    async (args) => {
      const when = String(args.when ?? "");
      const fromZone = String(args.from_zone ?? "Europe/London");
      const zones = (args.zones as string[] | undefined) ?? [...DEFAULT_ZONES];
      const board = buildBoard(when, fromZone, zones);
      const lines = board.rows.map(
        (r) => `${r.label} (${r.zone}): ${r.time} — ${r.date} (${r.offset})`,
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ...board, summary: lines.join("\n") }),
          },
        ],
      };
    },
  );

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await fs.readFile(
        path.join(DIST_DIR, "mcp-app.html"),
        "utf-8",
      );
      return {
        contents: [
          { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  return server;
}
