import { App } from "@modelcontextprotocol/ext-apps";

type ZoneRow = {
  zone: string;
  label: string;
  date: string;
  time: string;
  offset: string;
  weekday: string;
};

type Board = {
  instant: string;
  from_zone: string;
  rows: ZoneRow[];
  summary?: string;
};

const whenEl = document.getElementById("when") as HTMLInputElement;
const fromZoneEl = document.getElementById("from-zone") as HTMLInputElement;
const boardEl = document.getElementById("board")!;
const errorEl = document.getElementById("error")!;
const refreshBtn = document.getElementById("refresh") as HTMLButtonElement;

const app = new App({ name: "Meeting Times", version: "0.1.0" });

function showError(message: string) {
  errorEl.hidden = !message;
  errorEl.textContent = message;
}

function renderBoard(board: Board) {
  showError("");
  if (board.from_zone) fromZoneEl.value = board.from_zone;
  boardEl.innerHTML = "";
  for (const row of board.rows) {
    const el = document.createElement("div");
    el.className = "row";
    el.innerHTML = `<div><div class="label">${escapeHtml(row.label)}</div><div class="zone">${escapeHtml(row.zone)}</div></div><div class="meta"><div class="time">${escapeHtml(row.time)}</div><div>${escapeHtml(row.date)} · ${escapeHtml(row.offset)}</div></div>`;
    boardEl.appendChild(el);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseBoard(result: { content?: Array<{ type: string; text?: string }> }): Board | null {
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as Board;
  } catch {
    return null;
  }
}

app.ontoolresult = (result) => {
  const board = parseBoard(result);
  if (board) renderBoard(board);
};

refreshBtn.addEventListener("click", async () => {
  const when = whenEl.value.trim();
  const from_zone = fromZoneEl.value.trim() || "Europe/London";
  if (!when) {
    showError("Enter a date and time, for example 2026-11-11T15:00.");
    return;
  }
  showError("");
  const result = await app.callServerTool({
    name: "show-meeting-times",
    arguments: { when, from_zone },
  });
  const board = parseBoard(result);
  if (board) renderBoard(board);
  else showError("The server did not return a board.");
});

app.connect();
