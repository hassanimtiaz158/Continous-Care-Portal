# SHURA Frontend Architecture

This document describes the architectural layout, state management, and component organization of the SHURA React frontend.

---

## 1. Core Stack
- **Framework:** React 18
- **Routing:** TanStack Router (`@tanstack/react-router`)
- **Build Tool:** Vite + Nitro (TanStack Start)
- **Styling:** Custom CSS with Tailwind utility classes (`tailwindcss`). Styling strictly adheres to the SHURA `DESIGN_SYSTEM.md`.
- **Motion:** Framer Motion (`framer-motion`)

---

## 2. Folder Structure
The codebase follows a domain-driven folder hierarchy within `/src`:

```
/src
  /components
    /dashboard     # Executive views, priority queues, and analytics
    /landing       # Unauthenticated marketing and product storytelling
    /workspace     # Core clinical case workspace (split-pane layout)
    /shared        # Domain-specific reusable primitives (ConfidenceMeter, SectionHeader)
    /ui            # Generic headless/Shadcn-style primitives (Buttons, Cards, Dialogs)
    /layout        # Application shell, sidebar, and global navigation
  /lib             # API integrations, backend fetching logic, and utilities
  /routes          # TanStack Router definitions
  /data            # Mock data and typescript interfaces
```

---

## 3. Layout Hierarchy

SHURA avoids the standard "endless scrolling page" paradigm in favor of rigid, app-like layouts that control information density.

1. **Application Shell (`ShuraApp`)**: Manages authentication state and global routing between the Dashboard and the Workspace.
2. **Clinical Overview**: A grid/dashboard layout that utilizes the full width of the screen.
3. **Clinical Workspace**: A highly constrained split-pane layout:
   - **ContextPanel (`w-80`)**: Sticky, fixed left column.
   - **WorkspaceCanvas (`flex-1`)**: Scrollable right pane.

*Note: Mobile layouts are explicitly unsupported or heavily degraded for the Clinical Workspace, as complex clinical decision support requires high-density desktop displays.*

---

## 4. State Management Approach

SHURA intentionally keeps state management simple and predictable:

- **Local UI State:** Handled via standard React `useState` and `useReducer` for complex interactions (e.g., the Sign-Off slider).
- **Server State / API:** Handled primarily through asynchronous functions in `lib/api.ts` coupled with React hooks or `useEffect`. (Migration to TanStack Query is planned for future scalability).
- **Prop Drilling vs Context:** Currently, patient data and workflow state are passed down explicitly from the `ClinicalWorkspace` controller to its sub-components (`ClinicalEvidence`, `AIBoardSection`, etc.). This strict top-down flow ensures that sub-components remain pure and predictable, making debugging clinical logic straightforward.

---

## 5. Backend Integration Strategy

All backend communication is abstracted into `/lib/api.ts`.

- **Mocking vs. Live:** The application gracefully falls back to structured mock data if the backend Python server (FastAPI/LangChain) is unavailable.
- **Asynchronous Execution:** Heavy operations, specifically `runBoard()` which triggers the multi-agent deliberation, are designed to be asynchronous. The frontend immediately reflects an "In Progress" state, allowing the physician to maintain context while polling or waiting for the webhook/response.

---

## 6. Shared Component Guidelines

When building a new feature, developers must pull from the shared libraries:
1. **Always check `/ui` first** for basic inputs, cards, or structural elements.
2. **Check `/shared` second** for clinical-specific elements like `AIStatusBadge` or `MetricCard`.
3. **Do not create bespoke CSS** for standard elements. Use the Tailwind variables mapped in `index.css` (`text-void`, `bg-gold`, `border-line`).

---

## 7. Future Scalability Recommendations

As SHURA scales, the following architectural upgrades are recommended:

1. **TanStack Query Migration:** Move all `useEffect` based data fetching in `/workspace` components to `useQuery` for built-in caching, polling, and stale-time management.
2. **Global Store:** Implement Zustand or Redux strictly for global UI state (like Theme, Sidebar expanded/collapsed, or global notification toasts) to avoid drilling props from the router root.
3. **WebSockets for Deliberation:** Upgrade the `AIBoardSection` polling to WebSockets for real-time streaming of agent thoughts and intermediate conflict resolutions.
