import { describe, expect, it } from "vitest";
import { buildProposalPrompt, PROPOSAL_PROMPT_LIMITS } from "./proposal_prompt.js";

describe("buildProposalPrompt", () => {
  const baseInput = {
    doctrine: { diplomacy: 0.5, expansion: 0.5, science: 0.5, security: 0.5 },
    officer: { department: "Science", name: "Dr. Zeta", traits: ["Analytical", "Cautious"] },
    world: { bodies: [], cities: [] },
  };

  it("builds a deterministic prompt with minimal required fields", () => {
    const request = buildProposalPrompt(baseInput);

    expect(request.system).toContain("You are a commanding officer");
    expect(request.prompt).toContain("Name: Dr. Zeta");
    expect(request.prompt).toContain("Department: Science");
    expect(request.prompt).toContain("Traits: Analytical, Cautious");
    expect(request.prompt).toContain("Diplomacy: 0.50");
    expect(request.prompt).toContain("Cities:\nNone");
    expect(request.prompt).toContain("Bodies:\nNone");
    expect(request.prompt).toContain("--- RECENT EVENTS ---\nNone");
  });

  it("sorts and limits events correctly", () => {
    const events = Array.from({ length: 15 }, (_, i) => ({
      description: `Event ${i}`,
      turn: i,
    }));

    const request = buildProposalPrompt({
      ...baseInput,
      events,
    });

    expect(request.prompt).toContain(`Turn 14: Event 14`);
    // Should have exactly PROPOSAL_PROMPT_LIMITS.maxEvents
    const eventMatches = request.prompt.match(/Turn \d+:/g);
    expect(eventMatches).toHaveLength(PROPOSAL_PROMPT_LIMITS.maxEvents);
  });

  it("sorts and limits intel correctly", () => {
    const intel = Array.from({ length: 10 }, (_, i) => ({
      faction: `Faction ${i}`,
      report: `Report ${i}`,
    }));

    // Randomize order to test sorting
    const shuffledIntel = [...intel].reverse();

    const request = buildProposalPrompt({
      ...baseInput,
      intel: shuffledIntel,
    });

    // Should sort alphabetically by faction
    expect(request.prompt).toContain(`[Faction 0] Report 0`);
    const intelMatches = request.prompt.match(/\[Faction \d+\]/g);
    expect(intelMatches).toHaveLength(PROPOSAL_PROMPT_LIMITS.maxIntel);
  });

  it("sorts and limits requests correctly", () => {
    const requests = Array.from({ length: 8 }, (_, i) => ({
      department: `Dept ${i}`,
      request: `Req ${i}`,
    }));

    const request = buildProposalPrompt({
      ...baseInput,
      requests: [...requests].reverse(),
    });

    expect(request.prompt).toContain(`From Dept 0: Req 0`);
    const reqMatches = request.prompt.match(/From Dept \d+:/g);
    expect(reqMatches).toHaveLength(PROPOSAL_PROMPT_LIMITS.maxRequests);
  });

  it("sorts cities and bodies alphabetically", () => {
    const request = buildProposalPrompt({
      ...baseInput,
      world: {
        bodies: [{ name: "Zeta" }, { name: "Alpha" }],
        cities: [
          { control_level: 0.8, name: "City B", population: 100 },
          { control_level: 0.5, name: "City A", population: 200 },
        ],
      },
    });

    const user = request.prompt;
    const alphaIndex = user.indexOf("- Alpha");
    const zetaIndex = user.indexOf("- Zeta");
    expect(alphaIndex).toBeLessThan(zetaIndex);

    const cityAIndex = user.indexOf("- City A");
    const cityBIndex = user.indexOf("- City B");
    expect(cityAIndex).toBeLessThan(cityBIndex);
  });
});
