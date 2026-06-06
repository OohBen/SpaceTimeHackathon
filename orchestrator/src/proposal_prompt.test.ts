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

  it("produces byte-identical output for identical input (determinism)", () => {
    const input = {
      doctrine: { diplomacy: 0.42, expansion: 0.31, science: 0.18, security: 0.77 },
      events: [
        { description: "Skirmish at Phobos", turn: 7 },
        { description: "Trade pact signed", turn: 9 },
      ],
      intel: [
        { faction: "Vega Combine", report: "Fleet movement near Ceres" },
        { faction: "Aurora Pact", report: "Embassy opened on Luna" },
      ],
      officer: {
        department: "Operations",
        name: "Cmdr. Mira",
        traits: ["Decisive", "Aggressive"],
      },
      requests: [
        { department: "Engineering", request: "Approve dry-dock expansion" },
        { department: "Diplomacy", request: "Authorize summit on Titan" },
      ],
      world: {
        bodies: [{ name: "Titan" }, { name: "Ceres" }],
        cities: [
          { control_level: 0.61, name: "New Geneva", population: 4200 },
          { control_level: 0.83, name: "Aldrin Crater", population: 1800 },
        ],
      },
    };

    const first = buildProposalPrompt(input);
    const second = buildProposalPrompt(input);
    expect(first.prompt).toBe(second.prompt);
    expect(first.system).toBe(second.system);

    // Mutating order of arrays must not change the prompt — sorting is enforced.
    const shuffled = {
      ...input,
      events: [...input.events].reverse(),
      intel: [...input.intel].reverse(),
      requests: [...input.requests].reverse(),
      world: {
        bodies: [...input.world.bodies].reverse(),
        cities: [...input.world.cities].reverse(),
      },
      officer: { ...input.officer, traits: [...input.officer.traits].reverse() },
    };
    expect(buildProposalPrompt(shuffled).prompt).toBe(first.prompt);
  });

  it("populates every section when all sources are present", () => {
    const request = buildProposalPrompt({
      doctrine: { diplomacy: 0.2, expansion: 0.4, science: 0.6, security: 0.8 },
      events: [{ description: "Anomaly detected", turn: 3 }],
      intel: [{ faction: "Rival", report: "Probe sighted" }],
      officer: { department: "Science", name: "Dr. Iris", traits: ["Curious"] },
      requests: [{ department: "Logistics", request: "Reroute convoy" }],
      world: {
        bodies: [{ name: "Mars" }],
        cities: [{ control_level: 0.5, name: "Olympus", population: 3000 }],
      },
    });

    expect(request.prompt).toContain("--- OFFICER PROFILE ---");
    expect(request.prompt).toContain("--- FACTION DOCTRINE ---");
    expect(request.prompt).toContain("--- WORLD STATE ---");
    expect(request.prompt).toContain("--- RECENT EVENTS ---\nTurn 3: Anomaly detected");
    expect(request.prompt).toContain("--- INTELLIGENCE ---\n[Rival] Probe sighted");
    expect(request.prompt).toContain("--- OUTSTANDING REQUESTS ---\nFrom Logistics: Reroute convoy");
    expect(request.prompt).toContain("- Olympus (Pop: 3000, Control: 0.50)");
    expect(request.prompt).toContain("- Mars");
  });

  it("never emits private data beyond the supplied input (privacy boundary)", () => {
    // The orchestrator must not invent or smuggle context the server did not pass in.
    const input = {
      doctrine: { diplomacy: 0.5, expansion: 0.5, science: 0.5, security: 0.5 },
      officer: { department: "Science", name: "Dr. Zeta", traits: ["Analytical"] },
      world: { bodies: [], cities: [] },
    };
    const request = buildProposalPrompt(input);

    // No rival/opposing-faction tokens should appear when intel is omitted.
    expect(request.prompt).not.toMatch(/rival|opposing|enemy faction/i);
    // Sections present but explicitly empty.
    expect(request.prompt).toContain("--- INTELLIGENCE ---\nNone");
    expect(request.prompt).toContain("--- RECENT EVENTS ---\nNone");
    expect(request.prompt).toContain("--- OUTSTANDING REQUESTS ---\nNone");
    // Only the supplied officer name appears.
    const nameMatches = request.prompt.match(/Dr\. [A-Z][a-z]+/g) ?? [];
    expect(nameMatches.every(n => n === "Dr. Zeta")).toBe(true);
  });
});
