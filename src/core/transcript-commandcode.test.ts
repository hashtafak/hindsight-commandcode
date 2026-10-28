import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCommandcodeTranscript } from "./transcript-commandcode";

/**
 * Fixtures are Command Code transcript records, sampled from a real session file
 * (~/.commandcode/projects/<slug>/<session>.jsonl): a leading `type:"session"` history header,
 * then `type:"message"` records whose role lives on `message.role`. Mirrors what
 * transcript.test.ts pins for the Claude reader.
 */
function write(lines: unknown[]): string {
  const dir = mkdtempSync(join(tmpdir(), "cc-transcript-"));
  const path = join(dir, "session.jsonl");
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join("\n"));
  return path;
}

const SESSION_HEAD = {
  type: "session",
  version: 3,
  id: "f66a0fff",
  timestamp: "2026-10-25T15:34:27.647Z",
  cwd: "D:\\DATA\\repo",
};

describe("readCommandcodeTranscript", () => {
  it("keeps user and assistant prose turns with their timestamps, skipping the session header", () => {
    const transcript = write([
      SESSION_HEAD,
      {
        type: "message",
        id: "a",
        timestamp: "2026-10-25T15:38:28.030Z",
        message: { role: "user", content: [{ type: "text", text: "fix the login bug" }], meta: { source: "user" } },
      },
      {
        type: "message",
        id: "b",
        timestamp: "2026-10-25T15:40:01.000Z",
        message: { role: "assistant", content: [{ type: "text", text: "Found it in auth.ts." }], meta: { source: "model" } },
      },
    ]);
    expect(readCommandcodeTranscript(transcript)).toEqual([
      { role: "user", content: "fix the login bug", timestamp: "2026-10-25T15:38:28.030Z" },
      { role: "assistant", content: "Found it in auth.ts.", timestamp: "2026-10-25T15:40:01.000Z" },
    ]);
  });

  it("drops thinking blocks and renders each tool_use as one compact action turn", () => {
    const transcript = write([
      {
        type: "message",
        id: "a",
        timestamp: "2026-10-25T15:38:28.030Z",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "Look at the login module first.", signature: "" },
            { type: "text", text: "Checking auth.ts." },
            { type: "tool_use", id: "t1", name: "read_file", input: { absolute_path: "src/auth.ts" } },
            { type: "tool_use", id: "t2", name: "shell_command", input: { command: "npm test\nnpm run lint" } },
          ],
          meta: { source: "model" },
        },
      },
    ]);
    expect(readCommandcodeTranscript(transcript)).toEqual([
      { role: "assistant", content: "Checking auth.ts.", timestamp: "2026-10-25T15:38:28.030Z" },
      { role: "action", content: "read_file src/auth.ts", timestamp: "2026-10-25T15:38:28.030Z" },
      { role: "action", content: "shell_command npm test", timestamp: "2026-10-25T15:38:28.030Z" },
    ]);
  });

  it("drops tool-result records (meta.source tool) and tool_result-only turns", () => {
    const transcript = write([
      {
        type: "message",
        id: "a",
        message: {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "t1", content: [{ type: "text", text: "export const ok = true" }] },
          ],
          meta: { source: "tool", messageId: "m1" },
        },
      },
      {
        type: "message",
        id: "b",
        message: {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "t2", content: [] },
            { type: "text", text: "Now apply the fix." },
          ],
          meta: { source: "user" },
        },
      },
    ]);
    expect(readCommandcodeTranscript(transcript)).toEqual([
      { role: "user", content: "Now apply the fix." },
    ]);
  });

  it("strips injected hook memory from prose", () => {
    const transcript = write([
      {
        type: "message",
        id: "a",
        message: {
          role: "user",
          content: [{ type: "text", text: "<hindsight_knowledge>Memory is a past record</hindsight_knowledge> Ship the parser." }],
          meta: { source: "user" },
        },
      },
      {
        type: "message",
        id: "b",
        message: {
          role: "user",
          content: [{ type: "text", text: "<hindsight_knowledge>only injected</hindsight_knowledge>" }],
          meta: { source: "user" },
        },
      },
    ]);
    expect(readCommandcodeTranscript(transcript)).toEqual([{ role: "user", content: "Ship the parser." }]);
  });

  it("fails open: non-message records, non-conversation roles, malformed lines and non-object records are skipped", () => {
    const dir = mkdtempSync(join(tmpdir(), "cc-transcript-"));
    const path = join(dir, "session.jsonl");
    const content = [
      JSON.stringify(SESSION_HEAD),
      '{"type":"summary","summary":"earlier work"}',
      `{"type":"message","message":{"role":"system","content":"internal","meta":{"source":"system"}}}`,
      "{not json",
      "42",
      `{"type":"message","message":{"role":"user","content":[{"type":"text","text":"still here"}],"meta":{"source":"user"}}}`,
    ].join("\n");
    writeFileSync(path, content);
    expect(readCommandcodeTranscript(path)).toEqual([{ role: "user", content: "still here" }]);
  });

  it("returns no turns for a missing file", () => {
    expect(readCommandcodeTranscript(join(tmpdir(), "does-not-exist.jsonl"))).toEqual([]);
  });
});
