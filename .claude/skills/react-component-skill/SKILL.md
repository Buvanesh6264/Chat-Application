---
name: react-component-skill
description: Component scaffold matching frontend design conventions — folder-per-feature placement, Zustand selector usage, Context consumption, prop conventions.
---

# React component pattern

**Placement**: folder-per-feature under `frontend/src/components/` — `components/chat/`, `components/profile/`, `components/stories/`. Shared primitives (Button, Modal, Avatar) only go in `components/common/`. Never create a folder-per-type structure (no global `components/buttons/`).

**Naming**: `PascalCase.jsx` for component files, matching the exported component name.

**Reading global state**:
- High-frequency chat/presence/typing data: subscribe to `useChatStore` (Zustand) via a **selector**, never destructure the whole store — `const messages = useChatStore((s) => s.messagesByChatId[chatId])`, not `const { messagesByChatId } = useChatStore()`. Whole-store subscriptions re-render on every unrelated update.
- Auth session: consume via `useAuth()` (wraps `AuthProvider` context) — never read/write auth state through Zustand.

**Media uploads**: run images through `services/imageCompression.js` before calling the upload flow — never pass a raw `File` straight to the signed-upload step.

**Props**: functional components with destructured props and explicit defaults inline (`{ size = 'md' }`), no `PropTypes`/`defaultProps` statics.

**Styling/design tokens**: use the spacing scale, color tokens, and icon set documented in `frontend/CLAUDE.md` — don't introduce one-off pixel values or ad-hoc colors.
