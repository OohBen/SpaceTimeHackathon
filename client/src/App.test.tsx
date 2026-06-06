import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App.tsx";

describe("App scaffold", () => {
  it("renders Solar Dominion heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /solar dominion/i })).toBeDefined();
  });
});
