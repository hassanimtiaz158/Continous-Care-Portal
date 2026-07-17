# SHURA Design System

This document is the single source of truth for the SHURA design language, component architecture, and interaction philosophy. Every new feature, screen, and component must adhere to these rules.

---

## 1. Brand Philosophy

**Personality:** Trust, Intelligence, Clinical Precision, Enterprise Quality, Premium Craftsmanship.
**Design Goals:** SHURA should feel like mission-critical software built for hospitals. The UI reduces cognitive load, focuses entirely on data, and leaves no ambiguity. 
**Clinical Principles:** "Evidence before opinion." "We build for truth, not for convenience."
**Human-first AI Philosophy:** AI serves as a transparent specialist board (deliberating, cross-auditing, gathering evidence) while the human physician remains the ultimate decider. The AI never acts as a black box.

---

## 2. Color System

SHURA utilizes a tailored "Void & Gold" aesthetic. Avoid standard generic colors (like `#FF0000` for red); always use the semantic palette defined below.

- **Backgrounds**
  - **Void (`#0B1119`)**: Primary background color for the application shell.
  - **Void-2 / Slate (`#141C24`)**: Elevated background for panels, cards, and interactive elements.
  - **Void-3 (`#111A26`)**: Subtle nested background.
- **Text**
  - **Cream (`#EFE9DA`)**: Primary text color.
  - **Muted (`#7C8494`)**: Secondary text, metadata, labels, disabled states.
- **Accents & Brands**
  - **Gold (`#C9A227`)**: Primary brand color. Used for accents, active states, and focus.
  - **Gold Dim (`#8A731E`)**: Hover states and subtle borders.
  - **Line (`rgba(201, 162, 39, 0.22)`)**: Global border color. Used to define bounds without relying on shadows.
- **Semantic / Clinical Status**
  - **Teal (`#3D8B8B`)**: Nephrology, stable status, secure.
  - **Amber (`#E9C558`)**: Cardiology, elevated risk, warnings.
  - **Rose (`#B23A48`)**: Endocrinology, critical risk, conflicts, errors.
  - **Done / Success (`#4F7A5A`)**: Finalized, locked, signed-off states.

---

## 3. Typography

SHURA uses a three-tier typography system to distinguish between narrative text, quantitative data, and brand voice.

- **Headings & Brand (`Fraunces`, serif)**
  - Used exclusively for page titles, hero text, and large quantitative metrics (e.g., Confidence Scores).
  - Gives the platform a premium, editorial, and authoritative feel.
- **Body & Data (`IBM Plex Sans`, sans-serif)**
  - Primary font for all clinical data, patient notes, forms, and general UI text.
  - Highly legible for dense information.
- **Metadata & Logs (`IBM Plex Mono`, monospace)**
  - Used for system IDs, session hashes, timestamps, small labels, and status badges.
  - Ensures numerical data aligns perfectly and communicates "machine precision."

---

## 4. Spacing System

- **Standard Scale**: Use standard Tailwind spacing metrics (e.g., `gap-4`, `p-6`, `mb-8`).
- **Densification**: Clinical tools require high information density. Do not use overly large paddings inside data tables or forms. `p-4` or `p-6` is preferred for standard cards.
- **Workspace Canvas**: The main scrollable canvas should have generous horizontal padding (`px-8` to `px-12`) and a constrained max-width (`max-w-4xl` or `max-w-5xl`) to prevent line-lengths from exceeding optimal readability (60-80 characters).
- **Zoning**: Separate distinct conceptual areas (e.g., Evidence vs. Deliberation) with substantial vertical margins (`mt-12`).

---

## 5. Layout Rules

- **Desktop-First**: SHURA is a professional clinical tool. Complex workspaces (like the Clinical Case Workspace) assume a desktop viewport.
- **Split Workspaces**: The standard layout for clinical action is a split-pane view:
  - **Sticky Context Panel (Left)**: Fixed width (e.g., `w-80`). Always visible. Contains immutable patient identity, history, and completeness metrics.
  - **Scrollable Canvas (Right)**: Flexible width (`flex-1`). Contains the active workflow, evidence, AI deliberation, and physician sign-off.
- **Flat Architecture**: Avoid deep nested tabs. The physician should scroll to see the evolution of a case rather than clicking through hidden tabs.

---

## 6. Component Standards

- **Cards**: Background `bg-slate` (Void-2), Border `border-line`. No heavy box-shadows. Corners standard `rounded-xl`.
- **Buttons**:
  - Primary: Transparent background with `border-gold` and `text-gold`. Hover: `bg-gold/10`.
  - Secondary/Ghost: `text-muted` hover to `text-cream`.
- **Status Badges**: Small, `font-mono`, uppercase tracking (`tracking-widest`), colored borders mapped to semantic status (Teal/Rose/Amber).
- **Empty States**: Never use cartoon illustrations. Use a single monochrome icon (`text-muted`), a mono-spaced label, and an optional subtle dashed border.
- **Section Headers**: Use the `SectionHeader` shared component. It provides a consistent `Fraunces` title, an optional mono subtitle, and a subtle bottom border.

---

## 7. Motion Language

- **Motion Always Communicates Meaning**: Never use motion purely for decoration.
- **Durations**: Standard interactions should be fast (`duration-200` to `duration-300`). State transitions (like signing off a case) can be longer (`duration-700` to `1000ms`) to add weight to the action.
- **Easing**: Use `ease-out` for most entrances.
- **Hover Behavior**: Elements should subtly lift (`-translate-y-0.5`) or brighten borders (`border-gold-dim`) rather than transforming wildly.
- **Workflow Transitions**: As AI deliberates, sections should fade in sequentially, drawing the eye down the page naturally.

---

## 8. Iconography

- **Library**: `lucide-react`.
- **Usage**: Icons should be functional. Avoid using icons beside every single text label.
- **Styling**: Typically `w-4 h-4` or `w-5 h-5` with `text-muted` or a semantic color. Use `strokeWidth={1.5}` for a sharper, premium feel.

---

## 9. Data Visualization

- **Confidence Meters**: Represented as linear progress bars or radial dials. The fill color should map to the semantic color of the specific agent (e.g., Rose for Endocrinology).
- **AI Status Indicators**: When an AI is thinking, use a pulsing dot or a subtle glowing border.
- **Audit Timelines**: Vertical lines connecting dots to show the precise chronological order of system events.

---

## 10. Accessibility

- **Contrast**: Text must contrast sufficiently against the `Void` background. `Cream` and `Muted` are specifically chosen to pass WCAG AA on `#0B1119`.
- **Focus Indicators**: Forms and buttons must use a `focus:ring-gold/50` or similar clear indicator. Do not remove outlines without replacing them.
- **Motion Reduction**: Respect `prefers-reduced-motion` for heavy animations like the Sign-off sequence.

---

## 11. Interaction Patterns

- **Workflow Progression**: Top-to-bottom. Evidence -> Deliberation -> Consensus -> Grounding -> Human Decision.
- **Sign-off Interactions**: High-stakes decisions (approving a care plan) require intentional friction. Use the "Slide to Sign" pattern instead of a simple click button to prevent accidental approvals.
- **Non-Destructive Actions**: Data entered cannot be deleted, only superseded. Emphasize "appending" over "editing".

---

## 12. Signature Experiences

These interactions are the defining moments of the SHURA brand. They must be preserved and expanded:
- **The Deliberation Board**: The moment the user clicks "Convene Board," the UI must visualize multiple agents thinking, exchanging data, and resolving conflicts. It should feel like a live control room.
- **Grounding / Prove-It Mode**: Users must always be able to click an AI claim and see the exact highlight in the source evidence.
- **The Sign-Off Ritual**: Sliding the signature block triggering a golden sweep, sealing the case, and generating the immutable Audit Ledger. 

---

## 13. Migration Checklist

The following components from the legacy Lovable prototype violate the new SHURA Design System and must be refactored or deleted before moving to Sprint 2.

### To Delete (Replaced by new Workspace Architecture)
- [ ] `src/components/ArchivistPanel.tsx`
- [ ] `src/components/AuditTrail.tsx`
- [ ] `src/components/Background.tsx`
- [ ] `src/components/Consensus.tsx`
- [ ] `src/components/EvidenceChain.tsx`
- [ ] `src/components/Hero.tsx`
- [ ] `src/components/PatientOverview.tsx`
- [ ] `src/components/ReviewWorkspace.tsx`
- [ ] `src/components/Transparency.tsx`

### To Refactor / Restyle
- [ ] `src/components/SpecialistBoard.tsx`: Move away from raw CSS classes in `index.css` to Tailwind utility classes, applying the Void & Gold standard spacing and layout.
- [ ] `src/index.css`: Prune dead CSS classes that belonged to `RecordScreen` and `GridScreen`.
- [ ] `src/components/ui/*`: Review generic Shadcn/ui components (like Tabs, Select, Input) to ensure they default to Void & Gold styling rather than default Shadcn zinc/slate.
