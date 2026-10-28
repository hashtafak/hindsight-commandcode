/**
 * Command Code session transcript (JSONL) reader — the same normalized-turn contract as
 * transcript.ts for Claude Code, but for Command Code's record shapes:
 *
 *   {"type":"session", ..., "cwd": "..."}                        — one per file, skipped
 *   {"type":"message",
 *    "message":{"role":"user"|"assistant",
 *               "content": string | [{type:"text"|"thinking"|"tool_use"|"tool_result",...}],
 *               "meta":{"source":"user"|"model"|"tool", ...}},
 *    "timestamp": "ISO"}                                        — role drives the reader
 *
 * Keeps the engineering substance of a session (user requests, assistant narration, and one
 * compact `role:"action"` turn per tool call); drops `thinking` blocks, tool_result records and
 * tool_result-only turns, and any injected-memory wrappers (`<hindsight_knowledge>` et al, which
 * the hooks themselves inject) so a write-back can never re-ingest its own recall. Fail-open:
 * a missing file or a malformed line never throws.
 */
import type { TransportTurn } from "./chat";
import { readJsonl } from "./jsonl";
import { actionLine, stripInjectedMemory } from "./transcript-util";

interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: unknown;
  content?: string | ContentBlock[];
}

interface CommandcodeLine {
  type?: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: string | ContentBlock[];
    meta?: { source?: string };
  };
}

interface RenderedLine {
  role: string;
  content: string;
}

/** Render one message's `content` into turns — mirrors transcript.ts's renderLine (same rules:
 *  text blocks join into one prose turn, each `tool_use` becomes its own `role:"action"` turn,
 *  `tool_result` blocks are dropped). */
function renderLine(content: string | ContentBlock[] | undefined, role: string): RenderedLine[] {
  if (typeof content === "string") {
    const text = stripInjectedMemory(content).trim();
    return text ? [{ role, content: text }] : [];
  }
  if (!Array.isArray(content)) return [];

  const texts: string[] = [];
  const actions: RenderedLine[] = [];
  for (const b of content) {
    if (!b || typeof b !== "object") continue;
    if (b.type === "text" && typeof b.text === "string") {
      const t = stripInjectedMemory(b.text).trim();
      if (t) texts.push(t);
    } else if (b.type === "tool_use" && typeof b.name === "string") {
      actions.push({ role: "action", content: actionLine(b.name, b.input) });
    }
    // tool_result: dropped — outputs are mechanical noise for extraction
  }

  const out: RenderedLine[] = [];
  const joined = texts.join("\n").trim();
  if (joined) out.push({ role, content: joined });
  out.push(...actions);
  return out;
}

/** Parse a Command Code transcript JSONL into normalized turns. Role comes from
 *  `message.role` (the record-level `type` is just "message"); tool results and the session
 *  header record are skipped. Never throws on bad lines. */
export function readCommandcodeTranscript(path: string): TransportTurn[] {
  const turns: TransportTurn[] = [];
  for (const rawLine of readJsonl(path)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    // JSON.parse accepts non-object top-level values (`null`, numbers, booleans, arrays);
    // guard here so a corrupt/truncated line can't reach a property access below and throw.
    if (typeof parsed !== "object" || parsed === null) continue;
    const line = parsed as CommandcodeLine;

    // "session" is the single history header record (`{type, version, id, cwd, ...}`); anything
    // else this reader does not model is skipped by the same gate, fail-open.
    if (line.type !== "message") continue;

    const meta = line.message?.meta;
    const source = typeof meta === "object" && meta !== null ? meta.source : undefined;
    // Tool-result records carry the outputs of the assistant's calls as user-role messages with
    // meta.source:"tool"; the turn text never renders them anyway, but a record that IS only a
    // tool result renders to nothing — dropping it up front keeps that rule independent of shape.
    if (source === "tool") continue;

    const role = line.message?.role;
    if (role !== "user" && role !== "assistant") continue;

    for (const rendered of renderLine(line.message?.content, role)) {
      const turn: TransportTurn = { role: rendered.role, content: rendered.content };
      if (typeof line.timestamp === "string") turn.timestamp = line.timestamp;
      turns.push(turn);
    }
  }

  return turns;
}
