import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "./App.tsx";
import type { SessionBackend } from "./session/spacetime";

function backend(): SessionBackend {
  return {
    isConnected: true,
    identity: null,
    sessions: [],
    factions: [],
    client: null,
    getSessionChoices: () => [],
    getSlotChoices: () => [],
    joinOrResume: vi.fn(),
    createAndJoin: vi.fn(),
  };
}

describe("App scaffold", () => {
  it("renders Solar Dominion heading", () => {
    render(<App backend={backend()} />);
    expect(screen.getByRole("heading", { name: /solar dominion/i })).toBeDefined();
  });
});
