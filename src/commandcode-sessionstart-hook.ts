#!/usr/bin/env node
/** hindsight-commandcode-sessionstart-hook — Command Code `SessionStart` hook: seeds a cold
 *  repo's bank in the background and injects the knowledge-page bank mission (see core/session-start.ts). */
import { runHarnessSessionStart } from "./harness/hook-lifecycle";

void runHarnessSessionStart("commandcode");
