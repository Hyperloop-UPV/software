# UI Package - Frontend Kit

This package is the main UI and React shared component library for the Hyperloop Control Station. It provides reusable, styled components and hooks built on top of **React**, **Shadcn/UI**, and **Tailwind CSS**.

## Project Guidelines

### React-Only Logic

> This package is specifically for **UI and React-related components**.
>
> - If your logic requires React hooks (`useState`, `useEffect`, etc.) or TSX, it belongs here.
> - **If your logic does NOT need React** (e.g., websocket connections), it should be implemented in the `@workspace/core` package. This keeps the codebase clean and allows for better reuse across different environments.

---

## Icon Management

We use a custom Rust-based tool, **icons-master**, to manage our Lucide icon exports. This tool helps keep our icons organized by category and ensures we don't have duplicate exports.

### Usage

Here are the scripts you can run:

```bash
# Install dependencies
pnpm install

# Run linter
pnpm lint

# Add a new icon from Lucide (Example: pnpm icon:add arrow-up src/icons)
pnpm icon:add <icon-name> src/icons

# Remove an existing icon export (Example: pnpm icon:remove arrow-up src/icons)
pnpm icon:remove <icon-name> src/icons
```
