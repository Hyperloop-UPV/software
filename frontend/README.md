# Frontend

This is a monorepo workspace managed with **pnpm** and **Turborepo**.

## ⚠️ Important: Package Manager

**You MUST use `pnpm` for this project.** Do not use `npm`, `yarn`, or `bun`.

The project is configured to enforce pnpm usage. If you don't have pnpm installed, install it first:

```bash
npm install -g pnpm
```

## Getting Started

All commands should be executed from the `frontend` folder.

### Installation

Install all dependencies:

```bash
pnpm install
```

### Available Scripts

Run these commands from the `frontend` folder:

- **`pnpm dev`** - Start development servers for all packages
- **`pnpm build`** - Build all packages
- **`pnpm lint`** - Lint all packages
- **`pnpm format`** - Format code using Prettier

### Installing Dependencies

To add a new dependency to a specific package, use:

```bash
pnpm add <package-name> --filter <package-name>
```

For example, to add a dependency to `testing-view`:

```bash
pnpm add <package-name> --filter testing-view
```

To add a dev dependency:

```bash
pnpm add -D <package-name> --filter <package-name>
```

### Installing shadcn/ui Components

To install shadcn/ui components, use `pnpm dlx` (pnpm's equivalent to npx) with the `-c` flag to specify the components configuration file location:

```bash
pnpm dlx shadcn@latest add <component-name> -c frontend-kit/ui/components.json
```

For example, to add a button component:

```bash
pnpm dlx shadcn@latest add button -c frontend-kit/ui/components.json
```

The components will be installed in `frontend-kit/ui/src/components/shadcn/`.

## Project Structure

This monorepo contains:

- **`frontend-kit/`** - Shared UI components and utilities
  - `ui/` - shadcn/ui components and custom components
  - `core/` - Core utilities and WebSocket functionality
  - `esling-config/` - Shared ESLint configurations
  - `typescript-config/` - Shared TypeScript configurations
- **`testing-view/`** - Testing application
- **`competition-view/`** - Competition view application

## Requirements

- Node.js >= 20
- pnpm >= 10.24.0
