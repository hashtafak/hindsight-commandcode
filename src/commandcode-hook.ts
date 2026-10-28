#!/usr/bin/env node
/**
 * hindsight-commandcode-hook — the Command Code `UserPromptSubmit` entry point.
 *
 * Command Code's session hook surface is SessionStart / PreToolUse / PostToolUse / Stop — there is
 * no `UserPromptSubmit` event yet, so the installer wires only SessionStart and Stop and leaves
 * this binary for the day the host adds the event. Behavior once wired mirrors Claude Code's
 * (claude-hook.ts): recall every prompt; reflect once per session on the first prompt with the
 * outcome cached so later prompts recall only.
 */
import { runHarnessPrompt } from "./harness/hook-lifecycle";

void runHarnessPrompt("commandcode");
