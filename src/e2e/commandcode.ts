/**
 * Command Code — hook harness (SessionStart + Stop wired; no UserPromptSubmit yet on v1.88).
 *
 * Driven through the stub model via `--print`, mirroring the Claude Code setup — but Command Code
 * has no env-var retarget for its model loop a fresh container can use, and its first-launch
 * onboarding needs a Command Code account. Until a headless configuration path exists, this setup
 * is registered-but-skipped the way claude-code and cursor-cli are: install/uninstall wiring, the
 * transcript reader and the hook lifecycle are covered by installer.test.ts and
 * transcript-commandcode.test.ts.
 */
export const commandcodeDockerSetup = {
  name: "commandcode",
  hindsightHarness: "commandcode",
  unsupported:
    "`cmd -p` hangs to the timeout with the stub serving 0 requests: a fresh container has never " +
    "finished Command Code's onboarding, and there is no documented env redirect (like " +
    "ANTHROPIC_BASE_URL for Claude Code) that points its model loop at the stub. The wire itself " +
    "(hooks in ~/.commandcode/settings.json + the ~/.commandcode/projects transcript reader) is " +
    "covered by installer.test.ts and transcript-commandcode.test.ts.",
  installCommand: "hindsight-coding-agents install commandcode",
  stubModelEnv: (baseUrl: string) => ({
    COMMANDCODE_PROVIDER_BASE_URL: `${baseUrl}/v1`,
    COMMANDCODE_PROVIDER_API_KEY: "hindsight-e2e",
  }),
  command: (prompt: string) => ["cmd", "-p", prompt],
};
