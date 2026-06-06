import { describe, it, expect } from "vitest";
import { MODULE_VERSION } from "./lib.js";

describe("server module scaffold", () => {
  it("exports a module version string", () => {
    expect(typeof MODULE_VERSION).toBe("string");
    expect(MODULE_VERSION.length).toBeGreaterThan(0);
  });
});
