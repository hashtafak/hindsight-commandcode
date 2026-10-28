#!/usr/bin/env node
/** hindsight-commandcode-stop-hook — Command Code `Stop` hook: writes the session transcript
 *  (~/.commandcode/projects/<slug>/<session>.jsonl) back to memory the way claude-stop-hook does
 *  for Claude Code. */
import { runHarnessRetain } from "./harness/hook-lifecycle";

void runHarnessRetain("commandcode");
