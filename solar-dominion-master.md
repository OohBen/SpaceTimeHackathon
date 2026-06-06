# Solar Dominion — Master Design & Technical Document

*2-player competitive space colonization simulation on SpacetimeDB*
*Version 3.0 — Consolidated*

---

## Table of Contents

1. [Concept & Core Insight](#1-concept--core-insight)
2. [Design Goals](#2-design-goals)
3. [Game Length & Session Structure](#3-game-length--session-structure)
4. [The Solar System](#4-the-solar-system)
5. [Gameplay Loop](#5-gameplay-loop)
6. [Personnel System](#6-personnel-system)
7. [Doctrine System](#7-doctrine-system)
8. [Infrastructure & Cities](#8-infrastructure--cities)
9. [Resource Economy](#9-resource-economy)
10. [Faction Interaction & Conflict](#10-faction-interaction--conflict)
11. [Population & Morale](#11-population--morale)
12. [Random Events](#12-random-events)
13. [Winning Conditions](#13-winning-conditions)
14. [UI/UX Philosophy](#14-uiux-philosophy)
15. [Visual Language](#15-visual-language)
16. [Screen Architecture](#16-screen-architecture)
17. [Screen Diagrams](#17-screen-diagrams)
18. [Onboarding](#18-onboarding)
19. [Technical Architecture](#19-technical-architecture)
20. [LLM Integration](#20-llm-integration)
21. [Demo Script](#21-demo-script)

---

## 1. Concept & Core Insight

**Solar Dominion** is a 2-player competitive strategy game. Each player commands a faction racing to colonize and control the solar system. Both factions begin on Earth with a single city. Over the course of the game — 30 to 60 minutes of real time — they expand outward, compete for resources, develop colonies, and fight for dominance.

The defining mechanic: **players never directly execute actions.** They build a command organization that generates proposals. The player's job is to hire good people, fund the right initiatives, and choose wisely from the options their organization surfaces.

This reframes every system:

- Recruitment is not about stats — it's about what this person will propose and how they'll influence the people around them.
- Doctrine is not a tech tree — it shapes what kinds of opportunities your organization can perceive at all.
- Organizational structure is your information pipeline, not overhead.

**The faction that wins is the one that builds the better decision-making machine — and sustains it across the solar system.**

---

## 2. Design Goals

**Decisions compound.** A strong hire in Year 1 pays dividends for the whole game. A bad strategic direction taken early becomes a liability by midgame.

**Growth creates problems.** A 5-person faction is easy to run. A 40-person faction spanning Earth, Mars, and three Jovian moons generates competing priorities, morale demands, and command overhead. Scaling up should feel harder, not just bigger.

**Competition is multi-dimensional.** Factions fight through colonization races, resource pressure, talent poaching, propaganda, and military force — not one axis.

**The interface communicates visually first.** Morale, control, resources, threats — players should be able to read the state of the game at a glance. Text is for decisions, not status.

**Sessions are complete in 30–60 minutes.** Turns are simultaneous. Time limits prevent stalling. The game respects the player's time.

**Onboarding is ambient, not didactic.** The game teaches through play. Mechanics are intuitive enough that players learn by doing, not by reading tutorial panels.

---

## 3. Game Length & Session Structure

### Session Length Target

A complete game session runs **30–60 minutes** of real time.

### Turn Structure

**Turns are simultaneous.** Both players review proposals, allocate resources, and make decisions at the same time. There is no waiting for the opponent to finish their turn before you start yours.

**Each turn has a time limit.** When the timer expires, unresolved proposals are auto-deferred and the turn advances regardless. Neither player can hold the game hostage.

| Game Phase | Turns | Turn Timer | Real Time |
|------------|-------|------------|-----------|
| Early (Earth + Inner System) | 1–8 | 90 seconds | ~12 min |
| Mid (Belt + Jupiter) | 9–20 | 75 seconds | ~15 min |
| Late (Saturn + Deep) | 21–30 | 60 seconds | ~15 min |
| **Total** | **30** | — | **~42 min** |

Each in-game turn represents one year (not one quarter — simplified from earlier design for session length).

### Turn Timer Display

A visible countdown is shown at all times during the decision phase. When both players submit before the timer expires, the turn advances immediately — no waiting for the clock to run out. Fast, decisive players are rewarded.

When time expires, the UI briefly shows which proposals were auto-deferred (grayed out in the inbox for one beat), then the resolution sequence plays.

### Turn Phases

```
WORLD UPDATE (automated, ~2 seconds)
    ↓
DELIBERATION (LLM generates proposals, ~5–8 seconds, both players see "advisors preparing...")
    ↓
SIMULTANEOUS DECISION (both players act independently, timer running)
    ↓
RESOLUTION (automated, ~3 seconds, animated)
    ↓
next turn
```

---

## 4. The Solar System

### Distance Tiers

Distance is abstracted into three tiers. This drives travel time for colony ships and command response time (how quickly orders reach distant postings).

| Tier | Bodies | Travel Time | Command Lag |
|------|--------|-------------|-------------|
| Inner | Moon, Mercury, Venus, Mars | 1–2 turns | Minimal |
| Outer | Asteroid Belt, Ceres, Jupiter moons | 3–5 turns | Significant |
| Deep | Saturn system, Uranus, Neptune | 6–10 turns | Severe |

Command lag means a commander in a distant posting has been acting on old orders. Their autonomy tolerance trait determines how well they handle this. Poor autonomy tolerance + deep posting = unreliable behavior.

### Bodies & Strategic Value

**Earth** — Starting body. Both factions begin here with one city each. Highest base output. Direct competition from turn 1.

**Moon** — First expansion target. Close, fast to reach. Helium-3 deposits. Whoever gets here first has a launch advantage for further expansion.

**Mars** — The pivotal Inner System prize. Enough resources and gravity to support a large self-sustaining colony. High early investment, high long-term payoff. 3 city sites.

**Asteroid Belt / Ceres** — Primary metals and rare materials. Ceres as administrative hub. No large population — extraction installations only. Controls mid-game construction capacity.

**Jupiter System** — Outer System pivot point. Four viable colony locations (Ganymede, Europa, Io, Callisto) with distinct strategic profiles. Europa has exceptional research value. Io has high-risk high-yield mining. Ganymede and Callisto are defensible population centers.

**Saturn System** — Titan is the late-game prize. Dense atmosphere, liquid hydrocarbons, long-term colonization viability. 3 city sites. The faction that secures Titan controls the endgame energy economy.

**Deep System** — Uranus, Neptune. Extreme command lag. Commanders here operate almost fully autonomously. Only meaningful in the final turns.

### Resource Geography

| Resource | Primary Sources | Why It Matters |
|----------|----------------|----------------|
| Energy | Moon (He-3), Titan (hydrocarbons) | Powers all operations. Shortages cascade. |
| Metals | Asteroid Belt, Mars, Io | Construction, ships, infrastructure |
| Water | Mars subsurface, Europa, comets | Life support, fuel production |
| Rare Materials | Belt, ring installations | Advanced tech, late-game manufacturing |
| Research | Europa, Earth labs | Technology advancement |
| Population | Earth, Mars (long-term), Titan (long-term) | Colony growth, military recruitment |

Resource asymmetry is intentional. No single faction can be self-sufficient in all resources without controlling most of the solar system. Trade, competition, and strategic prioritization around resources are core to the game.

---

## 5. Gameplay Loop

### Every Turn

**Phase 1 — World Update (automated)**
- Orbital positions shift (affects travel times slightly)
- Opponent's prior decisions execute and become visible
- Events fire (weighted by game state)
- Colony ships in transit advance

**Phase 2 — Deliberation (automated, 5–8 seconds)**
Both players see: *"Your advisors are preparing proposals..."*
LLM generates proposals per department based on current game state.

**Phase 3 — Simultaneous Decision (timer active)**
Each player independently:
- Reviews proposals from their personnel
- Approves, rejects, or defers each
- Allocates resources to approved proposals
- Reviews the solar system map for strategic context
- Cannot see the opponent's decisions

Timer countdown is visible. Turn advances when both players submit OR timer expires.

**Phase 4 — Resolution (automated, ~3 seconds)**
All approved actions execute simultaneously:
- Colony ships launch or arrive
- Cities develop or stagnate
- Military engagements resolve
- Morale updates
- Research advances
- Doctrine drifts
- Control score updates

**Phase 5 — Resolution Summary (brief)**
Key events of the turn surface as a short sequential feed. Max 5 items. Player must tap through — never auto-advances.

### The Proposal System

Proposals are the primary interface between the player and their organization. The player never invents actions. Everything must come from their personnel.

**What determines proposal quality:**
- The proposing officer's competence
- Their morale and loyalty
- The faction's current doctrine (shapes what gets proposed)
- Their area's current conditions
- Their relationships with other officers

**A well-built organization** generates proposals that are creative, accurate, and strategically sound. The player faces hard choices between good options.

**A poorly-built organization** generates weak proposals, misses opportunities, and surfaces noise. The player either accepts poor options or defers everything — neither is good.

### Resource Allocation

Each turn the player has a fixed pool of resources. Approved proposals consume resources. The player cannot approve more than they can fund. Every decision is a tradeoff.

Resources: Credits, Construction Capacity, Deployment Slots, Research Points, Political Capital.

---

## 6. Personnel System

Maximum faction size: **40 personnel** (not counting the player).

### Roles

| Role | Count | Function |
|------|-------|----------|
| Chief of Staff | 1 | Primary advisor. Filters and frames proposals before they reach the player. |
| Fleet Admiral | 1 | All military assets. Engagement, deployment, patrol proposals. |
| Theater Commanders | 3–4 | Regional commanders for each active theater. Semi-autonomous. |
| Military Officers | 6–8 | Garrison and fleet operations. Report to Theater Commanders. |
| Chief Engineer | 1 | All construction and infrastructure. |
| Engineers | 4–6 | City development, ship construction, resource extraction. |
| Chief Scientist | 1 | Research programs, tech advancement, scientific exploration. |
| Researchers | 3–4 | Scientific work. Europa and Deep System discoveries. |
| Intelligence Director | 1 | Surveillance, counterintel, sabotage, asset recruitment. |
| Operatives | 2–3 | Intelligence fieldwork. |
| Chief Administrator | 1 | Population governance, morale, colonial autonomy. |
| Colony Administrators | 3–4 | City-level governance. Directly affect local morale. |
| Diplomat | 1 | Trade negotiations, non-aggression arrangements. |
| Logistics Officer | 1 | Supply chains. Critical for Outer System operations. |

### Personnel Traits

Each trait is a value 0–1 that evolves over time.

**Competence** — Quality of ideas and output. High competence = better proposals.

**Creativity** — Probability of generating novel, breakthrough options rather than incremental ones. Higher variance in both directions.

**Reliability** — Likelihood of execution meeting commitment. Low reliability = projects run late and over-cost.

**Ambition** — Drive for advancement. Rewarded ambition drives performance. Frustrated ambition creates political problems.

**Political Skill** — Ability to build coalitions and navigate internal dynamics. Can elevate weak ideas or suppress strong ones.

**Communication** — Clarity of reporting upward. Poor communicators introduce noise into their layer.

**Loyalty** — Commitment to the faction. Degrades with neglect, unmet ambition, or ideological conflict with doctrine. A disloyal commander in a distant posting is a serious threat.

**Autonomy Tolerance** — Performance under independent operation. Outer System postings demand this. Low autonomy tolerance + deep posting = unreliable behavior and potential defection.

### Knowledge & Succession

Officers carry knowledge: technical expertise, colony-specific understanding, relationship networks, operational memory. When they leave — retirement, death, defection — that knowledge degrades or disappears.

Managing knowledge means:
- Documentation (converts individual knowledge to organizational knowledge)
- Cross-training (distributes knowledge across multiple people)
- Mentorship (junior officers absorb knowledge from seniors)

### Career Development

A junior officer recruited in Year 1 can become a Theater Commander by Year 15 with the right assignments and mentorship. Factions that invest in personnel development compound organizational capability that cannot be quickly purchased or replicated.

### Retention & Defection

Officers leave when compensation is inadequate, ambition is chronically frustrated, doctrine conflicts with their values, or the opposing faction recruits them successfully. Defection in a Outer System command is catastrophic — the defector takes operational knowledge of the entire theater.

---

## 7. Doctrine System

Doctrine is the faction's accumulated strategic personality. It is not assigned — it emerges from the pattern of decisions the player makes over time.

Every resource allocation, every approved proposal, every personnel appointment sends a doctrinal signal. Officers observe what gets funded and rewarded, and adjust their behavior accordingly.

### Doctrine Axes

Doctrine is tracked along five bipolar axes. Current position on each axis is computed from the history of decisions.

| Axis | Left Pole | Right Pole |
|------|-----------|------------|
| Strategy | Expansionist | Consolidationist |
| Approach | Militarist | Diplomatic |
| Command | Centralist | Autonomist |
| Focus | Scientific | Industrial |
| Style | Rigid | Adaptive |

### Doctrine Effects

**Expansionist** — More colonization proposals, faster expansion, higher supply strain, more coordination problems.

**Consolidationist** — Deeper development of existing colonies, more stable but slower reach. Hard to dislodge from held territory.

**Militarist** — Stronger combat proposals, better deterrence, higher cost, population friction.

**Diplomatic** — Resolves conflicts through negotiation and trade. Struggles with direct aggression. Creates more durable loyalty in held territory.

**Centralist** — Tight Earth control. Better oversight. Command lag in distant theaters is debilitating. Cannot respond quickly to local crises.

**Autonomist** — Theater commanders act independently within broad intent. Fast local response. Requires high loyalty and autonomy tolerance in those commanders.

**Scientific** — Unique technology proposals. Slower military and industrial development. Technology advantages compound.

**Industrial** — Fast construction and fleet capacity. Resource-intensive. Technology falls behind patient scientific rivals.

**Rigid** — Predictable, reliable execution. Slow to adapt to changing conditions.

**Adaptive** — Fast pivots. Inconsistent expectations for personnel. Can be demoralizing for officers who value stability.

### Doctrine and Proposals

Doctrine shapes what proposal types are generated. A militarist faction sees rich military proposals and sparse diplomatic ones. A scientific faction receives proposals its industrial rival never sees. Different doctrines unlock different late-game capabilities — the most significant source of strategic differentiation.

### Distant Commands and Doctrine

Theater commanders in deep postings govern according to the doctrine they internalized — not orders they can barely receive. The doctrine established in Years 1–10 governs how Saturn theater runs in Year 25. This is one of the most consequential long-horizon effects in the game.

---

## 8. Infrastructure & Cities

### City Attributes

Each city has:

- **Population** — Number of inhabitants. Grows slowly early, faster as infrastructure matures.
- **Infrastructure Level** — Development tier (1–5). Each tier unlocks higher output and new capabilities.
- **Morale** — Population sentiment. See Section 11.
- **Industrial Output** — What the city produces this turn.
- **Research Output** — Scientific work performed.
- **Garrison** — Military force defending the city.
- **Supply Status** — Adequacy of incoming resources. Directly affects morale and output.

### Colony Development Stages

**Transit** — Ship in flight. Personnel unavailable. Arrival time based on distance tier.

**Establishment** — Landed. Basic life support constructed. Minimal output. Vulnerable to contest.

**Early Development** — 2–3 turns of investment before basic productivity begins. High fragility. Administrator's competence is decisive here.

**Maturation** — Self-sustaining in life support. Generating net positive output. Population begins growing naturally.

**Full Development** — High infrastructure, stable population, strong output. Takes sustained investment across many turns.

### Technology

Technology is not a tree — it emerges from research investment and key discoveries. Advancement areas:

- **Propulsion** — Faster ship transit between tiers.
- **Life Support** — Cheaper colony maintenance.
- **Energy Systems** — More efficient extraction and generation.
- **Military Technology** — Fleet and garrison capability.
- **Construction** — Faster city development.
- **Communications** — Better command response in distant theaters.

Technology advantages compound. A faction 5 turns ahead in propulsion reaches contested bodies faster for the rest of the game.

---

## 9. Resource Economy

### Resource Flows

Each city produces and consumes resources every turn. Net surplus or deficit determines whether the faction is compounding or burning reserves.

Consumption includes: city operations, garrison upkeep, personnel salaries, active projects, ship transit, research programs.

### Supply Lines

Outer System colonies require active resupply. A supply route must be maintained from Earth or an intermediate colony. Disrupted supply lines cause morale deterioration and infrastructure degradation that worsen every turn until restored.

### Trade Between Factions

Trade is possible and sometimes mutually beneficial — one faction may have energy surplus, the other metals surplus. Trade creates dependency. A faction reliant on the opponent for a critical resource is vulnerable to economic coercion. The Diplomat role manages this.

---

## 10. Faction Interaction & Conflict

Competition is multi-dimensional. The faction that wins only through military force has almost certainly lost on the economic and governance axes.

### Colonization Racing

First to establish a defended presence on an unclaimed body claims the city site. Quality matters — a rushed colony with a poor administrator and inadequate garrison is a liability. The colonization race is the primary source of tension in turns 1–15.

### Intelligence Operations

The Intelligence Director generates proposals for:

- **Surveillance** — Monitor opponent movements, construction, personnel changes.
- **Counterintelligence** — Detect and neutralize opponent surveillance.
- **Asset Recruitment** — Long-term cultivation of opponent personnel toward defection.
- **Misinformation** — Feed false intelligence to the opponent. High risk if detected.
- **Sabotage** — Disrupt specific opponent operations. Attribution risk triggers escalation.

### Military Operations

**Interdiction** — Block opponent supply lines. Forces convoy protection commitment.

**Orbital Pressure** — Position assets above an opponent colony. Degrades morale without direct conflict.

**Siege** — Cut off a colony from resupply while maintaining orbital dominance. Colony either negotiates or deteriorates.

**City Assault** — Direct military takeover. Expensive, damages infrastructure, generates long-term resentment. Last resort, rarely optimal.

### Propaganda

Target opponent populations with morale-degrading campaigns. Effective against cities with high pre-existing grievances. Takes multiple turns to work. Countered by good administration.

### Talent Poaching

Recruit specific opponent officers. High-performers at low-loyalty factions are prime targets. A successful poach brings the target's knowledge and damages the opponent's capability.

---

## 11. Population & Morale

Morale is the most underestimated system. Players who ignore it find their late-game positions fragile.

### Morale Range: 0–100

| Range | State | Effect |
|-------|-------|--------|
| 70–100 | High | +20–40% productivity, voluntary recruitment, political capital generation |
| 35–69 | Mid | Baseline productivity |
| 0–34 | Low | Reduced output, desertion risk, susceptibility to propaganda, event generation |

### Morale Drivers

**Positive:** Adequate supply, competent local administration, military security, cultural connection to faction mission, political representation for older colonies.

**Negative:** Supply shortages, incompetent or corrupt administration, military occupation without security justification, economic extraction without reinvestment, communication blackouts in distant colonies.

### Colonial Identity

Colonies older than ~10 turns develop local identity. Their populations are not Earthlings — they are Martians, Ganymedans, Titanians. Ignoring this builds slow resentment. The Chief Administrator will surface proposals about colonial governance. Ceding some autonomy in exchange for genuine loyalty is usually correct.

### Occupied Cities

Cities taken by force immediately drop to 20–40% morale. Rebuilding requires sustained administrative investment and time. An occupying faction that governs occupied cities poorly will find them a net drain rather than a net asset.

---

## 12. Random Events

Events are weighted by game state. They create decisions, not just outcomes. The best events force a choice between two legitimate options with real tradeoffs.

### Event Design Rule

Every event must contain a decision. An event that just imposes a penalty without a choice is a design failure.

### Event Examples

**Coronal Mass Ejection** — Solar storm threatens Inner System colonies. Harden infrastructure (expensive, slow), evacuate key personnel (disruptive), or accept the risk and prepare emergency response.

**Commander Goes Dark** — A distant Theater Commander stops reporting. Send an investigation mission, replace them preemptively, or wait. Silence in a deep posting is ambiguous.

**Colonial Independence Movement** — A major colony organizes a formal autonomy movement. Negotiate governance, suppress, or ignore. Each path has different long-term implications.

**Defection Opportunity** — An opponent officer is unhappy and potentially recruitable. Committing intelligence resources with no guaranteed outcome and exposure risk.

**Supply Chain Crisis** — A critical route is disrupted. Reroute (slow), emergency airlift (expensive), or manage deterioration while finding a solution.

**Technology Breakthrough** — A research program produces something unexpected. Exploit immediately (fast, shallow) or develop carefully (slow, deeper).

**Political Fracture** — Two senior personnel are in conflict affecting both departments. Resolution means choosing sides or restructuring.

**Succession Crisis** — A critical commander is incapacitated. Their replacement must be chosen from available personnel now.

---

## 13. Winning Conditions

### Victory Condition

**Solar Dominion** — one faction controls a decisive majority of populated, viable city-equivalents across the solar system, while the opponent cannot sustain meaningful resistance.

The game ends at Turn 30, or earlier if one faction achieves and holds dominance for 3 consecutive turns.

### Control Score

Final score is a weighted composite:

- **City control** — Infrastructure level × population of each owned city
- **Resource control** — Dominant positions in key resource nodes
- **Population loyalty** — High morale cities contribute fully; low morale cities contribute at discount
- **Institutional knowledge** — Documented org knowledge and developed doctrine
- **Military capacity** — Fleet and garrison distribution
- **Technology level** — Average advancement relative to opponent

### Why This Works

The score rewards building something durable. Military conquest without governance fails. Economic expansion without morale fails. The faction that wins is the one that built the better organization and then used it to build the better civilization.

---

## 14. UI/UX Philosophy

### The Four Governing Principles

**Information is the product.**
The player is a Supreme Commander receiving reports from an interplanetary organization. Every screen is a document — a proposal, a status briefing, a situation report. It should feel like one. Clean typography, strong hierarchy, no decorative chrome.

**Communicate visually first.**
Morale states, resource levels, territorial control, threat conditions — these should be readable at a glance through color, shape, and spatial relationships. Text is for decisions, not for status the eye can absorb faster.

**Friction should be meaningful.**
Hard decisions should feel hard because the *options* are hard, not because the interface is confusing. Navigation should be obvious. Actions should be reachable in one or two interactions. The game's complexity lives in its systems, not its menus.

**Cinematic restraint.**
Cinematic influence lives in transition timing, typographic weight, and the dramatic weight of a critical event arriving. Not in persistent animations, glowing effects, or decorative motion. The interface should feel like a command center in quiet operation — purposeful and still.

### What This Is Not

Not a busy space game UI with glowing hex borders and animated star fields. Not flat SaaS with generic sans-serif everything. Not retro-futurist CRT nostalgia. It is clean, dark, purposeful — with enough atmospheric weight to feel like command.

---

## 15. Visual Language

### Color System — Three Colors Only

The entire interface is built on exactly three colors plus their variants. Color always carries meaning. It is never decorative.

---

**COLOR 1: VOID** — The base. Near-black with a very slight blue-slate undertone.

```
Void 900 (deepest):  #080b11   — Primary background. The space between everything.
Void 800:            #0d1018   — Panel backgrounds.
Void 700:            #131824   — Elevated surfaces, cards.
Void 600:            #1c2333   — Borders, dividers.
Void 500:            #2a3550   — Subtle borders, focus rings.
Void 400:            #3d4f6b   — Inactive icons, placeholder text.
Void 300:            #6b7a94   — Secondary text, metadata.
Void 200:            #9aa3b5   — Secondary labels.
Void 100:            #c8cdd8   — Secondary body text.
Void 050:            #e8eaf0   — Primary text. Off-white, never pure white.
```

**COLOR 2: SIGNAL** — The active color. Used for the player's faction, interactive elements, confirmations, and positive states. A clear, confident blue.

```
Signal 900:  #0a1f3d   — Signal on dark surfaces (backgrounds)
Signal 700:  #1a4a8a   — Secondary interactive states
Signal 500:  #2d6fd4   — Primary interactive — buttons, links, active states
Signal 300:  #5a9df0   — Hover states, highlights
Signal 100:  #b8d4fa   — Signal on dark for text only
```

**COLOR 3: ALERT** — Used for the opponent's faction, threats, warnings, and critical states. A warm, assertive amber-red.

```
Alert 900:   #3d1a08   — Alert on dark surfaces
Alert 700:   #8a3a10   — Secondary warning states  
Alert 500:   #d45a20   — Primary alert — opponent color, warnings, critical states
Alert 300:   #f07a4a   — Elevated warning, hover
Alert 100:   #fad0b8   — Alert text on dark
```

---

**The Three-Color Rule in Practice:**

- Void: all backgrounds, all text, all structural elements
- Signal: player faction, interactive elements, nominal/positive states, confirmations
- Alert: opponent faction, threats, warnings, critical states, destructive actions

There are no other colors. Resource types are distinguished by icon shape, not color. Morale states are Void/Signal/Alert mapped to high/mid/low. The solar system map uses Void (unclaimed), Signal (player control), Alert (opponent control).

---

### Typography

**Primary: Inter** (screen-optimized, excellent at small sizes)
**Monospace: JetBrains Mono** (all numerical data — resource values, coordinates, timers, counts)

```
Text sizes:
  xs:    11px / 1.4  — Metadata, timestamps
  sm:    13px / 1.5  — Secondary body, table rows
  base:  15px / 1.6  — Primary body, proposals
  md:    17px / 1.5  — Section headers
  lg:    21px / 1.4  — Panel titles
  xl:    28px / 1.3  — Screen titles
  2xl:   38px / 1.2  — Win screen only

Weights: 400 (body), 500 (labels), 600 (headers), 700 (emphasis)
```

**Rules:**
- All numbers in JetBrains Mono always
- Hierarchy through weight and size, not color
- Body text: Void 050 (#e8eaf0)
- Secondary text: Void 200 (#9aa3b5)
- Metadata: Void 300 (#6b7a94)

---

### Custom SVG Icons

All icons are custom SVGs designed for this game's theme and vocabulary. No Unicode characters — they are too similar in small sizes and carry unintended semantic associations.

Icons are 16×16 or 20×20. Line style, 1.5px stroke, rounded caps. Filled only when indicating an active/selected state.

**Resource Icons** — Each resource has a unique geometric form readable at 16px:

```
Energy:       Radiating lines from center point (sun/emission form)
Metals:       Stacked horizontal bars with slight taper (ingot/layer form)
Water/Ice:    Three downward-converging curves (droplet abstraction)
Rare Mats:    Four-pointed crystalline form, asymmetric
Research:     Orbital arc with center dot (not a full atom — just one arc)
Population:   Two overlapping circles, slightly offset (people/group form)
Political:    Concentric incomplete rings (influence/reach form)
```

**System Tier Icons** — Used in navigation, city headers, any context showing body distance:

```
Inner System:  Solid filled circle — close, warm, substantial
Outer System:  Circle with inner ring gap — medium distance, partial
Deep System:   Circle outline only, slightly dashed — far, tenuous
```

**Status Icons** — Must be distinguishable by shape alone (not color alone):

```
Critical:    ▲ with interior ! (triangle — urgent, upward escalation)
Warning:     ◇ with interior · (diamond — caution, borderline)
Nominal:     ○ with interior ✓ (circle — contained, resolved)
Unknown:     ? in rounded square (question — no data)
```

**Action Icons** — Used on buttons and controls:

```
Approve:     Checkmark in circle
Reject:      X in circle
Defer:       Right-arrow in circle (push forward in time)
Launch:      Upward arrow with curved base (rocket abstraction)
Reinforce:   Plus in shield
Deploy:      Downward arrow into circle (land/place)
Recall:      Left-curved arrow (return)
Investigate: Magnifier with single line
```

**Navigation Icons** (sidebar):

```
Command Center:  Crosshair / targeting reticle form
Personnel:       Three ascending vertical bars (hierarchy)
Resources:       Horizontal bar with tick marks (gauge)
Intelligence:    Eye with horizontal line through (redacted/covert)
Diplomacy:       Two arrows facing each other (exchange)
```

---

### Spacing System

Base unit: 4px.
```
sp-1:  4px   sp-4: 16px   sp-8:  32px   sp-16: 64px
sp-2:  8px   sp-5: 20px   sp-10: 40px   sp-20: 80px
sp-3: 12px   sp-6: 24px   sp-12: 48px
```

---

### Motion & Transitions

```
Fast:        120ms ease-out   — hover, micro-interactions
Standard:    220ms ease-out   — panel transitions, state changes
Deliberate:  380ms ease       — new proposals arriving, alerts
Resolution:  600ms ease       — quarterly resolution, major events
```

**Rules:**
- Incoming proposals arrive with Deliberate timing — they feel like they matter
- Resolution sequence uses Resolution timing — the player feels time passing
- Nothing loops. No idle animations. The interface is still when not in use.
- Data updates are instant (SpacetimeDB push) — no interpolation on numerical values
- Turn timer counts down with a smooth Void→Alert color shift in the final 15 seconds

---

## 16. Screen Architecture

### Navigation Model

Solar Dominion uses a **persistent panel model**, not page navigation. The Command Center is always present as the base layer. All other views open as panels on top of or beside it.

The player never navigates away from the Command Center during a game. They open panels, close them, and the Command Center remains.

### Screen Inventory

**Pre-game:**
- Landing (faction name, new/continue)
- Game Setup (matchmaking, brief rules visual)
- Session Loading

**In-game (all panels within Command Center):**
- Command Center (base layer — always present)
- Personnel Panel (sidebar)
- Resource Dashboard (sidebar)
- Intelligence Panel (sidebar)
- Diplomacy Panel (sidebar)
- City Detail (map-triggered overlay)
- Doctrine View (faction header trigger)

**Turn flow:**
- Turn Resolution (full-screen takeover, brief)

**End-game:**
- End Game Summary (full-screen)

### Sidebar Navigation

Fixed left sidebar, 48px wide (icons only). Expands to 220px on hover/focus (icons + labels).

Five tabs, in order:
```
Command Center icon   — Command Center (home)
Personnel icon        — Personnel Panel
Resources icon        — Resource Dashboard
Intelligence icon     — Intelligence Panel
Diplomacy icon        — Diplomacy Panel
```

Active tab: Signal 500 left accent bar, Void 700 background.

### Global Header

Always visible. Contains:
```
[Faction Emblem]  Year X — Turn Y/30  |  [Turn Phase]  |  [Timer]  |  [Opponent Status]
```

Faction Emblem click → Doctrine View.
Timer is JetBrains Mono, Signal 300 → Alert 300 → Alert 500 as time decreases.
Opponent Status: "Deciding..." (Void 300) / "Ready ✓" (Signal 300).

---

## 17. Screen Diagrams

### Command Center

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  [▣ Faction]   Year 8 — Turn 8/30  |  DECISION PHASE  |  [01:23]  |  Ready ║
╠══╦═══════════════════════════════════════╦══════════════════════════════════╣
║  ║                                       ║  COMMAND INBOX              [3] ║
║  ║                                       ║ ─────────────────────────────── ║
║  ║                                       ║ ● Chief of Staff                ║
║  ║      SOLAR SYSTEM MAP                 ║   Strategic Overview · Y8       ║
║  ║                                       ║                                 ║
║ S║    ·  ·  EARTH●  ·  MOON○  ·         ║ ● Mars Theater Cmd              ║
║ I║                                       ║   Hellas Basin Colony Request   ║
║ D║            MARS●   MARS○              ║                                 ║
║ E║                                       ║ ● Chief Engineer                ║
║ B║        · BELT ◈ ·                     ║   Infrastructure Expansion      ║
║ A║                                       ║ ─────────────────────────────── ║
║ R║   JUP○  JUP○                          ║                                 ║
║  ║                                       ║  [SELECTED PROPOSAL]            ║
║  ║                    SAT○               ║                                 ║
║  ║                                       ║  "Recommend establishing a      ║
║  ║                                       ║  second Martian city at Hellas  ║
║  ╠═══════════════════════════════════════║  Basin. Current Mars colony     ║
║  ║ ⚡ 2,847 (+183) ◈ 1,204 (-47)         ║  output justifies expansion.    ║
║  ║ ❄  890  (+12)  ✦ 234  (+0)           ║  Est. cost: 800 CR, 2 turns."   ║
║  ║ ⬡ 48,204(+312) ⊕ 156 (+28) ◎892(-15) ║                                 ║
║  ║                                       ║  Cost: 800 CR  |  2 turns       ║
╚══╩═══════════════════════════════════════╬══════════════════════════════════╣
                                           ║  [✓ APPROVE]  [✕ REJECT]  [→ DEFER] ║
                                           ╚══════════════════════════════════╝
```

**Key elements:**
- Solar system map: bodies as circles, ● = player (Signal), ○ = opponent (Alert), · = unclaimed (Void)
- Morale ring around each player city: partial arc in Signal/Alert/Void based on morale state
- Resource bar: always visible, icon + JetBrains Mono value + delta
- Inbox: list of proposals with sender, subject, fidelity dot removed (info fidelity dropped)
- Selected proposal fills bottom-right panel
- Decision controls always visible when proposal selected

---

### Solar System Map (Detail)

```
                    SOLAR SYSTEM — YEAR 8

           ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·

      ·                                             ·
           ·   [MOON]          [MERCURY]        ·
      ·      ○ unclaimed       · unclaimed          ·
                  1.2 turns        1.4 turns
      ·                                             ·
         [EARTH]  ←— both factions start here
           ●A ●B  — two city markers, side by side
      ·                                             ·
           ·         [VENUS]                    ·
      ·               · unclaimed                   ·
                          1.8 turns
      ·                                             ·
           ·   ·   [MARS]    ·   ·              ·
      ·           ●A  ○B                            ·
                  Olympus   Hellas
                  City      Basin
      ·    [BELT / CERES]                       ·
           ◈ — extraction only, no city marker
      ·                                             ·

      ·   ·   ·   [JUPITER SYSTEM]   ·   ·   ·

               ○ Ganymede  · Europa
               unclaimed   unclaimed

                           [SATURN]
                           · Titan (unclaimed)
```

**Map Legend (shown as small key in map corner):**
```
● Signal  = Your city
○ Alert   = Opponent city
· Void    = Unclaimed
◈ Void    = Resource extraction (no city)
→ Arrow   = Colony ship in transit (animated dot along path)
```

**Morale indicator** — thin arc around each ● or ○:
- Full arc: high morale (Signal 300)
- Half arc: mid morale (Void 300)
- Quarter arc: low morale (Alert 300)

**Selected body** — clicking a city or unclaimed body opens City Detail overlay. Selected body glows with a soft Signal 500 ring.

---

### City Detail Panel

```
╔══════════════════════════════════════════╗
║  OLYMPUS CITY                    [×close]║
║  Mars · Inner System · Year 4 founded   ║
╠══════════════════════════════════════════╣
║                                          ║
║  POPULATION                              ║
║  ████████████░░░░░░  12,847  +312/yr    ║
║                                          ║
║  MORALE              ████████░░  71      ║
║  INFRASTRUCTURE      ██████░░░░  Lvl 3  ║
║  SUPPLY              ████████████  OK   ║
║                                          ║
╠══════════════════════════════════════════╣
║  PRODUCTION THIS TURN                    ║
║  ⚡ Energy      +420   ◈ Metals   +180  ║
║  ⬡ Population   +312   ⊕ Research  +24  ║
╠══════════════════════════════════════════╣
║  GARRISON                                ║
║  ████░░░░░░  847 personnel  · Nominal   ║
╠══════════════════════════════════════════╣
║  LOCAL COMMAND                           ║
║  Commander Chen  ·  Competence ████░░   ║
║                     Loyalty    ███████░  ║
╠══════════════════════════════════════════╣
║  ACTIVE PROJECTS                         ║
║  Infrastructure Expansion  ████████░░   ║
║  ETA: 1 turn                            ║
╚══════════════════════════════════════════╝
```

**Visual principles:**
- Bars for everything that has a range (morale, population, garrison, loyalty, progress)
- Numbers always in JetBrains Mono
- Signal color for player cities, Alert for opponent (viewed through intelligence)
- No walls of text — every stat is a labeled bar or icon+number

---

### Personnel Panel

```
╔══════════════════════════════════════════════════════╗
║  PERSONNEL COMMAND                         [×close]  ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║           [SUPREME COMMANDER]                        ║
║                   │                                  ║
║        ┌──────────┼──────────┐                       ║
║   [Chief        [Fleet      [Chief                   ║
║   of Staff]     Admiral]    Scientist]               ║
║      │              │            │                   ║
║  [Mars Cmd]  [Jupiter Cmd]  [Researcher]             ║
║      │                                               ║
║  [Hellas Adm]                                        ║
║                                                      ║
╠══════════════════════════════════════════════════════╣
║  SELECTED: Commander Chen · Mars Theater             ║
║  ──────────────────────────────────────────────────  ║
║  Competence      ████████░░   0.81                   ║
║  Reliability     ██████░░░░   0.61                   ║
║  Loyalty         ███████░░░   0.72  ▼ declining      ║
║  Ambition        █████████░   0.88  ⚠ unmet          ║
║  Autonomy Tol.   ████░░░░░░   0.43                   ║
║  ──────────────────────────────────────────────────  ║
║  Posting: Mars · Inner System · 6 turns              ║
║  Status:  Nominal · Ambition flag active             ║
║  ──────────────────────────────────────────────────  ║
║  [↑ Promote]  [⇄ Reassign]  [● Mentor Pair]         ║
╚══════════════════════════════════════════════════════╝
```

**Visual principles:**
- Org chart as hierarchy tree — the spatial relationship IS the information
- Each node: name + role + a single morale/loyalty dot (Signal/Alert/Void)
- Selected officer shows trait bars — all bars, no numbers except for the value beside bar
- Flags (ambition unmet, loyalty declining) as icon+label, not walls of text
- Action buttons always visible for selected officer

---

### Turn Resolution Screen

```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║                      YEAR 8 · RESOLVING                             ║
║                                                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ●  Olympus City infrastructure complete — Level 4 reached           ║
║                                           [SIGNAL bar fills]        ║
║                                                                      ║
║  ○  Opponent colony ship detected inbound to Ganymede               ║
║     ETA: 3 turns                          [Map updates — dot appears]║
║                                                                      ║
║  ▲  Ganymede unclaimed — opponent moving to contest it              ║
║                                                                      ║
║  ●  Research breakthrough: Propulsion efficiency +15%               ║
║                                                                      ║
║  ◇  Commander Chen morale stable — ambition still unaddressed       ║
║                                                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  CONTROL   ████████████████████░░░░░░░░  You: 52%  Opponent: 38%   ║
║                                                                      ║
║                         [ CONTINUE → ]                               ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

**Visual principles:**
- Max 5 events. Each is one line. Icon (●/○/▲/◇) signals faction/alert status.
- Events arrive sequentially with Deliberate timing, not all at once
- Map updates animate as events reference spatial locations
- Control bar shows relative position — simple, instant, readable
- CONTINUE is the only action — player must tap through, never auto-advances
- Tone is a terse mission log, not celebration language

---

### End Game Summary

```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║                        SOLAR DOMINION                                ║
║                                                                      ║
║                    ██████████████████████                            ║
║                         ATLAS CORP                                   ║
║                      CONTROLS THE SOLAR SYSTEM                      ║
║                           Year 27                                    ║
║                                                                      ║
╠══════════════════╦═══════════════════════════════════════════════════╣
║                  ║  ATLAS CORP        HELIX FACTION                  ║
║   [Solar system  ║  Cities:   14      Cities:   8                    ║
║    final state   ║  Morale:   76      Morale:   51                   ║
║    map — full    ║  Tech:     ████░   Tech:     ███░░                ║
║    color shown]  ║  Military: ████░   Military: ██░░░                ║
║                  ║  Score:    8,420   Score:    4,180                 ║
╠══════════════════╩═══════════════════════════════════════════════════╣
║  KEY TURNING POINTS                                                   ║
║  · Y3: Atlas secured Moon first — energy advantage sustained 24 yrs  ║
║  · Y11: Helix lost Ganymede to contested landing — Outer lost early  ║
║  · Y18: Atlas technology breakthrough — propulsion gap decisive       ║
║  · Y24: Titan colonized — game effectively over                       ║
╠══════════════════════════════════════════════════════════════════════╣
║                    [ PLAY AGAIN ]    [ MAIN MENU ]                   ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

### Doctrine View

```
╔══════════════════════════════╗
║  FACTION DOCTRINE    [×close]║
╠══════════════════════════════╣
║                              ║
║    Expansionist ────── Consol║
║    ●────────────○            ║
║                              ║
║    Militarist ──────── Diplo ║
║    ──────●──────────○        ║
║                              ║
║    Centralist ────── Autonom ║
║    ●──────────────○          ║
║                              ║
║    Scientific ──── Industrial║
║    ──────────○●              ║
║                              ║
║    Rigid ───────── Adaptive  ║
║    ──────●──────────○        ║
║                              ║
║  ● You  ○ Est. Opponent      ║
╠══════════════════════════════╣
║  UNLOCKED BY CURRENT DOCTRINE║
║  · Frontier colonist recruits║
║  · Rapid expansion proposals ║
║  · Supply strain events more ║
║    frequent                  ║
╚══════════════════════════════╝
```

Doctrine view shows both factions' positions (opponent is an estimated position derived from observed behavior via intelligence). No text-heavy explanation of every axis — just position on the slider and what the current position unlocks.

---

## 18. Onboarding

### Governing Principle

The game teaches through play. Tutorial content is minimal, contextual, and never blocking. A player who ignores every hint should still be able to figure out the game within the first 2–3 turns.

### The Situation Briefing (pre-game, 45 seconds)

One screen. In-world framing. No tutorial language.

```
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   SUPREME COMMANDER — SITUATION BRIEFING             ║
║                                                      ║
║   Year 1. Earth's resources are finite.              ║
║   A rival faction has been granted the same mandate. ║
║                                                      ║
║   Your command structure will propose.               ║
║   You decide. You resource. They execute.            ║
║                                                      ║
║   The solar system belongs to whoever builds         ║
║   the better organization.                           ║
║                                                      ║
║   Your Chief of Staff is ready.                      ║
║                                                      ║
║                       [ ASSUME COMMAND ]             ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

### Turn 1 — Guided by the Chief of Staff

The first inbox message is from the Chief of Staff. It is an LLM-generated briefing that naturally introduces what the player needs to know through in-world voice:

> *"Supreme Commander. I've prepared your first-turn proposals from the department heads — you'll find them in the inbox to the right. Approve what you want funded, reject what you don't, defer anything you're uncertain about. Resources are shown at the bottom. Your first decision concerns Earth city expansion — I'd recommend starting there."*

No callout boxes. No tooltip chains. One message from a character who sounds like they know what they're doing.

### Contextual First-Encounter Hints

The first time a player encounters a specific UI element, a single non-blocking label appears adjacent to it and fades after 8 seconds. These are brief, factual, never repeated.

Examples:
- First inbox item: *"Proposals from your personnel. Approve, reject, or defer."* (8 sec fade)
- First resource bar: *"Resources consumed by approved proposals."* (8 sec fade)
- First solar system map: *"Bodies in outline are unclaimed. Click to explore."* (8 sec fade)
- First timer: *"Both players decide simultaneously. Turn advances when both submit or timer expires."* (8 sec fade)

That is the entire tutorial. Four contextual labels, each appearing once, each fading in 8 seconds.

### Visual Intuitiveness as the Real Tutorial

The interface teaches itself through visual language:
- Signal color on interactive elements → "this is actionable"
- Alert color on opponent elements → "this is a threat"
- Bar graphs for all states → morale, loyalty, infrastructure instantly readable
- Resource delta colors → green good, red bad, no explanation needed
- Timer color shift → urgency visually communicated without text

A player who can read a bar chart and understands that green is good and red is bad can play this game.

### No Codex, No Tutorial Mode

There is no separate tutorial mode. There is no Codex. If a player wants to understand a mechanic more deeply, hovering over any UI element shows a one-sentence tooltip.

The game is designed to be learnable in one session.

---

## 19. Technical Architecture

### System Overview

```
┌──────────────────────────────────────────────────────┐
│                  Browser (React SPA)                  │
│  UI Components ←→ Zustand Store ←→ SpacetimeDB SDK   │
└──────────────────────────────────────────────────────┘
                          │
                   WebSocket (SpacetimeDB)
                          │
┌──────────────────────────────────────────────────────┐
│                    SpacetimeDB                        │
│  Tables (state)  ←  Reducers (logic)  → Subscriptions│
└──────────────────────────────────────────────────────┘
                          │
                  HTTP (async, one-way)
                          │
┌──────────────────────────────────────────────────────┐
│              LLM Orchestrator (Node.js)               │
│  Receives context → Calls Anthropic → Writes results  │
└──────────────────────────────────────────────────────┘
```

No traditional game server. SpacetimeDB handles authoritative state, access control, real-time sync, and all game logic. The LLM orchestrator is a narrow adapter between SpacetimeDB and the Anthropic API — no game logic lives there.

### Core Tables

```sql
game_sessions       (id, state, current_year, current_turn,
                     player_a_faction_id, player_b_faction_id,
                     turn_phase, turn_deadline)

factions            (id, session_id, player_id, name,
                     credits, political_capital, doctrine_vector,
                     control_score)

celestial_bodies    (id, name, system_tier, comms_lag_turns,
                     travel_time_turns, resource_deposits)

cities              (id, body_id, faction_id, name,
                     population, infrastructure_level, morale,
                     industrial_output, research_output,
                     garrison_strength, supply_status)

personnel           (id, faction_id, name, role, department,
                     posting_city_id,
                     competence, creativity, reliability,
                     ambition, political_skill, communication,
                     loyalty, autonomy_tolerance,
                     morale, burnout, salary)

personnel_relationships (id, personnel_a_id, personnel_b_id,
                         type, strength)

colony_ships        (id, faction_id, origin_id, destination_id,
                     manifest, departed_turn, arrives_turn)

fleets              (id, faction_id, posting_city_id,
                     strength, orders)

projects            (id, faction_id, city_id, type, name,
                     progress, resources_assigned, est_completion)

proposals           (id, faction_id, turn, proposing_personnel_id,
                     department, title, body, resource_cost,
                     confidence, status, decision)

commander_inbox     (id, faction_id, turn, from_personnel_id,
                     subject, body, requires_decision, status)

intelligence_records (id, observer_faction_id, target_faction_id,
                      intel_type, value, accuracy, acquired_turn)

events              (id, session_id, faction_id, turn,
                     event_type, payload, resolution)

trade_agreements    (id, session_id, faction_a_id, faction_b_id,
                     terms, signed_turn, expires_turn)
```

### Access Control

Private tables use row-level access control tied to faction ID. SpacetimeDB enforces this at the subscription layer — clients cannot subscribe to rows they don't own.

```rust
// Proposals are only visible to the owning faction
impl TableFilter for Proposal {
    fn filter(ctx: &ReducerContext, row: &Self) -> bool {
        row.faction_id == get_caller_faction_id(ctx)
    }
}

// Cities: public fields (location, faction control) visible to both
// Private fields (morale, garrison detail) only to owning faction
// Opponent sees city via intelligence_records (partial, accuracy-weighted)
```

### Turn Phase Reducer Sequence

```rust
// Phase 1: World update (automated)
#[reducer]
fn advance_world(ctx: &ReducerContext, session_id: u64) {
    advance_colony_ships(ctx, session_id);
    apply_prior_decisions(ctx, session_id);
    fire_weighted_events(ctx, session_id);
}

// Phase 2: Deliberation — queues LLM requests per faction
#[reducer]
fn run_deliberation(ctx: &ReducerContext, faction_id: u64) {
    let context = build_proposal_context(ctx, faction_id);
    insert_llm_request(ctx, "GENERATE_PROPOSALS", context, faction_id);
    // LLM orchestrator picks up request, writes proposals, marks complete
}

// Phase 3: Player decision (both players simultaneously)
#[reducer]
fn commander_decision(ctx: &ReducerContext,
                      faction_id: u64,
                      proposal_id: u64,
                      approved: bool,
                      allocation: ResourceAllocation) {
    validate_resources(ctx, faction_id, &allocation);
    update_proposal(ctx, proposal_id, approved);
    if approved { commit_resources(ctx, faction_id, allocation); }
}

// Called when player submits their turn OR timer expires
#[reducer]
fn end_turn(ctx: &ReducerContext, faction_id: u64) {
    mark_faction_ready(ctx, faction_id);
    if both_factions_ready(ctx) || timer_expired(ctx) {
        simulate_turn(ctx);
    }
}

// Phase 5: Simulation (runs after both submit or timer expires)
#[reducer]
fn simulate_turn(ctx: &ReducerContext, session_id: u64) {
    for faction in get_factions(ctx, session_id) {
        advance_projects(ctx, faction.id);
        develop_cities(ctx, faction.id);
        update_city_morale(ctx, faction.id);
        update_resource_flows(ctx, faction.id);
        resolve_military_ops(ctx, faction.id);
        evolve_doctrine(ctx, faction.id);
        update_personnel_state(ctx, faction.id);
        update_knowledge_assets(ctx, faction.id);
        recalculate_control_score(ctx, faction.id);
    }
    check_victory(ctx, session_id);
    advance_turn_counter(ctx, session_id);
}
```

### React Application Structure

```
src/
├── main.tsx
├── spacetime/
│   ├── client.ts          — SpacetimeDB connection
│   ├── subscriptions.ts   — All subscription definitions
│   ├── reducers.ts        — Typed reducer wrappers
│   └── types.ts           — Generated types from schema
├── store/
│   ├── gameStore.ts       — Game state (Zustand)
│   ├── uiStore.ts         — UI state (panels, selection)
│   └── sessionStore.ts    — Auth + session
├── components/
│   ├── layout/
│   │   ├── CommandCenter.tsx
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── map/
│   │   ├── SolarSystemMap.tsx
│   │   ├── CelestialBody.tsx
│   │   ├── FleetIcon.tsx
│   │   └── ShipTransit.tsx
│   ├── inbox/
│   │   ├── CommanderInbox.tsx
│   │   ├── InboxItem.tsx
│   │   ├── ProposalReader.tsx
│   │   └── DecisionControls.tsx
│   ├── personnel/
│   │   ├── OrgChart.tsx
│   │   ├── PersonnelCard.tsx
│   │   └── TraitBars.tsx
│   ├── colony/
│   │   ├── CityDetail.tsx
│   │   ├── MoraleBar.tsx
│   │   └── SupplyStatus.tsx
│   ├── resources/
│   │   ├── ResourceBar.tsx
│   │   └── ResourceDashboard.tsx
│   ├── resolution/
│   │   ├── TurnResolution.tsx
│   │   └── ResolutionEvent.tsx
│   └── shared/
│       ├── ProgressBar.tsx
│       ├── Tooltip.tsx
│       └── Icon.tsx         — All custom SVG icons
├── hooks/
│   ├── useSpacetime.ts
│   ├── useGameState.ts
│   └── useTurnPhase.ts
└── utils/
    ├── doctrine.ts
    ├── orbital.ts
    └── formatting.ts
```

### Client Subscription Architecture

```typescript
export function setupSubscriptions(sessionId: string, factionId: string) {

  // Shared world — both players see this
  client.subscribe([
    `SELECT * FROM celestial_bodies WHERE session_id = ${sessionId}`,
    `SELECT * FROM trade_agreements WHERE session_id = ${sessionId}`,
    `SELECT * FROM game_sessions WHERE id = ${sessionId}`,
    // Public city fields only (location + faction control)
    `SELECT id, body_id, faction_id, name, infrastructure_level
     FROM cities WHERE session_id = ${sessionId}`,
  ]);

  // Private faction state — this player only
  client.subscribe([
    `SELECT * FROM factions WHERE id = ${factionId}`,
    `SELECT * FROM personnel WHERE faction_id = ${factionId}`,
    `SELECT * FROM cities WHERE faction_id = ${factionId}`,  // full detail
    `SELECT * FROM proposals WHERE faction_id = ${factionId}`,
    `SELECT * FROM commander_inbox WHERE faction_id = ${factionId}`,
    `SELECT * FROM colony_ships WHERE faction_id = ${factionId}`,
    `SELECT * FROM fleets WHERE faction_id = ${factionId}`,
    `SELECT * FROM projects WHERE faction_id = ${factionId}`,
    `SELECT * FROM intelligence_records
     WHERE observer_faction_id = ${factionId}`,
  ]);
}
```

Turn phase changes propagate instantly. When both players submit, SpacetimeDB runs `simulate_turn`, updates all tables, and every subscribed client receives the diff automatically. No polling. No manual state sync.

---

## 20. LLM Integration

### Role

The LLM generates organizational voice — the words players read. It does not run the simulation. All outcomes are computed by deterministic reducers. The LLM's job is to make proposals feel like they come from specific people in specific situations.

### What the LLM Generates

**Proposals** — Per department, per turn. Structured context sent to Claude; response is proposals grounded in actual game state, written as the specific officer.

**Inbox Messages** — Quarterly briefings, event notifications, personnel communications. LLM-generated from character context. A Chief of Staff with low morale writes differently than a confident one.

**Event Narratives** — Events are triggered by simulation logic. Their human story is LLM-generated from faction and personnel context.

**Session Resume Briefing** — When a player returns to an in-progress game, the Chief of Staff delivers an LLM-generated catch-up summary of current conditions.

### Proposal Prompt Architecture

```typescript
function buildProposalPrompt(context: ProposalContext): Message[] {
  return [{
    role: 'system',
    content: `
You are ${context.officer.name}, ${context.officer.role}.

Personality:
- Competence: ${describeCompetence(context.officer.competence)}
- Communication: ${describeCommunication(context.officer.communication)}
- Morale: ${describeMorale(context.officer.morale)}
- Loyalty to Supreme Commander: ${describeLoyalty(context.officer.loyalty)}

Faction doctrine: ${describeDoctrine(context.faction.doctrine_vector)}

Your area of responsibility:
${context.area_summary}

Generate ${context.count} proposals for the Supreme Commander this turn.
Each must be specific, actionable, honest about resource requirements,
and reflect your current perspective and the conditions you're seeing.

Respond with JSON array only:
[{
  "title": "headline (max 8 words)",
  "body": "proposal text (100-200 words, first person)",
  "resource_cost": { "credits": number, "turns": number },
  "confidence": "HIGH|MEDIUM|LOW"
}]`
  }, {
    role: 'user',
    content: `
Year ${context.year}, Turn ${context.turn}.
Recent relevant events: ${context.recent_events}
Known opponent activity: ${context.intel_summary}
Outstanding requests from prior turns: ${context.outstanding}

Generate proposals.`
  }];
}
```

### LLM Budget

Per turn, per faction:
- 3–6 department proposal batches
- 2–3 inbox messages
- 0–2 event narratives

At 2 factions, ~15–20 LLM calls per turn. Across 30 turns, ~450–600 calls per game. Well within a practical budget.

### What the LLM Does Not Do

- Does not determine outcomes (deterministic reducers do this)
- Does not run events (simulation logic triggers events; LLM writes their text)
- Does not generate game rules or constraints

---

## 21. Demo Script

### Setup

Two browser windows side by side. Left: Faction A (player). Right: Faction B (opponent, pre-staged). Game loaded to Turn 8, Year 8 — Inner System well-developed, Mars contested, Jupiter beckoning.

---

### Beat 1: The Premise (30 seconds)

*"Solar Dominion is a 2-player competitive strategy game about colonizing the solar system. But you don't control ships or build structures directly — everything goes through your command organization. These proposals in the inbox were generated by your officers, each responding to the current game state with their own perspective and agenda."*

Point to the inbox — three proposals visible from Chief of Staff, Mars Theater Commander, Chief Scientist.

---

### Beat 2: The Proposal (60 seconds)

Click the Mars Theater Commander proposal. It expands to fill the right panel.

*"Commander Chen on Mars is recommending we push to Callisto before the opponent does. This was written by Claude, given her specific traits and the actual game state as context. She has high ambition — she wants a larger command. That's in the text."*

Point to supporting context: loyalty bar, competence bar below the proposal.

*"I'm going to approve this."*

Click APPROVE. Resource allocation widget appears.

*"800 credits, two construction teams. The decision goes to SpacetimeDB."*

Click Confirm.

---

### Beat 3: Real-Time Sync (45 seconds)

Point to the right window (Faction B).

*"Watch the opponent's map."*

Left window: trigger colony ship launch to Callisto.

Right window: a faint movement indicator appears near Jupiter. Intelligence notification arrives in opponent inbox.

*"The opponent's surveillance assets detected something near Jupiter. Not what — just a signal. Their Intelligence Director will factor this into next turn's proposals.*

*That happened through SpacetimeDB. No application server. No polling. Both clients subscribe to shared world state. The moment my reducer ran, the diff propagated. The opponent sees a signal — not the full picture — because their subscription filters only give them what their surveillance can detect."*

---

### Beat 4: Simultaneous Turns (30 seconds)

Point to the timer in the header.

*"Both players are deciding right now, simultaneously. When both submit, the turn advances immediately. If either runs out the timer, it advances anyway. Nobody waits. Nobody stalls."*

Submit the turn on the left window. The header on the right shows "Opponent ready ✓".

*"The opponent just submitted too. Turn advances."*

Resolution sequence plays.

---

### Beat 5: The Name (30 seconds)

*"The database is called SpacetimeDB. This game is about the problem of coordinating a civilization across spacetime — the friction that distance and command hierarchy impose on any organization trying to govern itself across the solar system."*

*"The architecture isn't incidental to the theme. It's the theme. Shared state, private subscriptions, reducer-enforced access control, real-time propagation of a living simulation — that's SpacetimeDB doing exactly what it was designed for."*

---

### Beat 6: Close (15 seconds)

*"30 turns. 30–60 minutes. The whole solar system. The winner isn't the best tactician — it's the player who builds the better organization. That's Solar Dominion."*

---

### Anticipated Judge Questions

**"How does the LLM integration work?"**
> *"Per department, per turn, we send Claude a structured context: the officer's traits, their current game state, faction doctrine, recent events. Claude responds as that officer. The outcomes — whether the project succeeds, how morale shifts — are all computed by deterministic reducers. Claude writes the words. The database runs the numbers."*

**"How is information asymmetry enforced without a server?"**
> *"Row-level access control in SpacetimeDB Rust modules. Private faction tables filter on faction ID. What the opponent sees about your territory comes through intelligence_records rows — partial, accuracy-weighted. The subscription layer enforces it. No application code required."*

**"Why two players only?"**
> *"Three players breaks down into kingmaking dynamics — the two weaker players always attack the leader regardless of strategic merit. Two players keeps the skill expression clean. Every action by one player has a direct, legible consequence for the other."*

**"What's the game length?"**
> *"30 turns, 30–60 minutes. Simultaneous turns with a timer. We're not trying to be Stellaris — we want a complete strategic arc in a lunch break."*

---

*Solar Dominion — Master Design & Technical Document*
*Version 3.0 — Full consolidated specification*
