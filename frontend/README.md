# Frontend

> **Note:** For general setup, prerequisites, and root-level commands, see the [main README](../README.md).

This directory contains the frontend workspace for the Hyperloop Control Station, built with React, TypeScript, and Vite.

## Architecture Overview

The frontend is organized as 6 workspaces out of 9 in the whole monorepo, divided into 3 main areas:

### Workspaces

| Workspace                                                          | Description                                           |
| :----------------------------------------------------------------- | :---------------------------------------------------- |
| `testing-view`                                                     | Primary telemetry testing and debugging interface     |
| `competition-view`                                                 | Competition-focused UI (simplified view)              |
| `frontend-kit/ui` or `@workspace/ui`                               | Component library built on shadcn/ui and Radix UI     |
| `frontend-kit/core` or `@workspace/core`                           | Shared business logic, WebSocket utilities, and types |
| `frontend-kit/eslint-config` or `@workspace/eslint-config`         | Common ESLint configurations                          |
| `frontend-kit/typescript-config` or `@workspace/typescript-config` | Common TypeScript configurations                      |

## Key Technologies

- **React 19** with TypeScript
- **Vite** for build tooling
- **Zustand** for state management
- **React Router** for navigation
- **Radix UI / shadcn/ui** for UI components
- **WebSocket** for real-time backend communication
- **@dnd-kit** for drag-and-drop functionality

## State Management

The application uses **Zustand** with a slice-based architecture:

- `workspacesSlice` - Manages workspaces, filters, charts, and tabs
- `catalogSlice` - Stores telemetry and command catalogs
- `telemetrySlice` - Real-time telemetry data
- `messagesSlice` - System messages and logs
- `appSlice` - Application mode and settings
- `rightSidebarSlice` - UI state for sidebar panels

### Workspace System

Testing View supports multiple workspaces to organize different testing scenarios. Each workspace has:

- Independent filters for commands and telemetry
- Separate chart configurations
- Isolated tab state and expanded items
- Persistent configuration

## WebSocket Integration

The frontend connects to the Go backend via WebSocket for real-time communication:

- **Connection**: `useWebSocket` hook from `@workspace/core`
- **Topics**: Subscribe to specific data streams using `useTopic`
  - `podData/update` - Telemetry data
  - `connection/update` - Backend connection status
  - `message/update` - System messages
- **Sending packets**: Send a message through websocket using `post` method from `socketService`

Example:

```tsx
import { useTopic, useWebSocket } from "@workspace/ui/hooks";
import { socketService } from "@workspace/core";

const { isConnected } = useWebSocket();

useTopic<TelemetryData>("podData/update", (data) => {
  // Handle telemetry data
});

socketService.post("order/send", <payload>);
```

## Component Library (@workspace/ui)

The shared UI package provides:

- shadcn/ui components (Button, Dialog, Dropdown, etc.)
- Custom components (Sidebar, Charts, Filters)
- Hooks (useWebSocket, useTopic, useLogger)
- Icons from Lucide React

Import components from `@workspace/ui`:

```tsx
import { Button, Dialog } from "@workspace/ui";
import { Plus, Settings } from "@workspace/ui/icons";
```

## Development Patterns

### Styling & Theming

- **CSS Variables** for theming (defined in `globals.css`)
- **Tailwind CSS** for utility classes
- **Dark mode** support via CSS class toggling
- Multiple color schemes (default, pink, etc.)

### Adding Icons

To add a new Lucide icon to the shared UI library:

1. Look up the icon on [Lucide Icons](https://lucide.dev/icons)
2. Find the **first category** listed for that icon
3. Add the import to the corresponding category file in `frontend-kit/ui/src/icons/`
4. If the category file doesn't exist, create it and add its export to `index.ts`
5. Keep the same alphabetical order as the icon categories

**Example:** The `Axe` icon's first category is `Tools`, so you would add its import to `tools.ts`:

```js
// frontend-kit/ui/src/icons/tools.ts
export { Axe, Hammer } from "lucide-react";
```

## Project Structure

```
frontend/
├── frontend-kit/
│   ├── ui/                    # Shared UI components
│   │   ├── src/components/    # React components
│   │   ├── src/hooks/         # Custom hooks
│   │   └── src/styles/        # Global styles
│   ├── core/                  # Business logic
│   │   └── src/               # WebSocket, utilities, types
│   ├── eslint-config/         # ESLint configs
│   └── typescript-config/     # TS configs
├── testing-view/
│   ├── src/
│   │   ├── assets/            # Assets (images, gifs, etc.)
│   │   ├── components/        # UI components
│   │   ├── layout/            # App layout
│   │   ├── pages/             # Route pages
│   │   ├── store/             # Zustand store slices
│   │   ├── hooks/             # Custom hooks
│   │   ├── constants/         # Config and constants
│   │   ├── types/             # TypeScript types
│   │   ├── mocks/             # Mocks
│   │   └── lib/               # Utilities
│   └── public/                # Static assets
└── competition-view/
    └── src/                   # Similar structure
```

## Common Tasks

### Adding a Dependency to a Specific Workspace

Use pnpm's `--filter` flag (run from root or frontend directory):

```bash
pnpm add <package> --filter testing-view
```

### Running a Specific Workspace

From root:

```bash
pnpm dev --filter testing-view
```

### Linting & Formatting

```bash
pnpm lint
pnpm format
```

## Testing

- Test framework: **Vitest**
- Component testing: **@testing-library/react**

Run tests:

```bash
pnpm test
```

## Build

Build all frontend packages:

```bash
pnpm build
```

Preview production builds:

```bash
pnpm preview
```

## Troubleshooting

### WebSocket Connection Issues

- Ensure backend is running on the expected port
- Check `.env.development` for `VITE_BACKEND_URL` configuration

### Store State Issues

- Use Redux DevTools extension for debugging Zustand state
- Ensure getters return stable references (use constants for empty arrays/objects)

### Component Re-render Issues

- Use React DevTools Profiler to identify excessive re-renders
- Ensure Zustand selectors are properly scoped

## Additional Resources

- [React Documentation](https://react.dev/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Vite Documentation](https://vitejs.dev/)
