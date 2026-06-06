import { describe, it, expect } from "vitest";
import { ORCHESTRATOR_VERSION } from "./index.js";

describe("orchestrator scaffold", () => {
  it("exports a version string", () => {
    expect(typeof ORCHESTRATOR_VERSION).toBe("string");
    expect(ORCHESTRATOR_VERSION.length).toBeGreaterThan(0);
  });
});
