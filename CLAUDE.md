# Dory - Claude Code Guidelines

## Project Structure

- Monorepo managed by Yarn 4 (Berry) workspaces
- `apps/web` — Next.js web app (main product)
- `apps/admin` — Next.js admin panel
- `apps/electron` — Electron desktop app
- `packages/auth-core` — Shared auth package

## Package Manager

- **Yarn 4** — use `yarn` commands, NOT `npm` or `pnpm`
- `yarn workspace <name> <cmd>` to run workspace-specific commands
- `yarn install` to install dependencies
- `yarn workspace web typecheck` to check types

## shadcn/ui

- Components live in `apps/web/registry/new-york-v4/ui/`
- Chart demos live in `apps/web/registry/new-york-v4/charts/`
- **To add/update components**: `yarn dlx shadcn@latest add <component-name> --overwrite`
- **To update multiple**: `yarn dlx shadcn@latest add comp1 comp2 comp3 --overwrite`
- shadcn CLI may pin dependency versions (remove `^`) or change versions — review `package.json` after running
- shadcn CLI installs to default path; if components are in a custom directory, you may need to move files after

## Dependency Upgrades

- Use `npx npm-check-updates --workspaces` to check for outdated dependencies across all workspaces
- Use `yarn npm audit` to check for known vulnerabilities
- For TypeScript major upgrades: run `npx @andrewbranch/ts5to6 --fixBaseUrl <tsconfig>` and `--fixRootDir <tsconfig>` to verify config compatibility
- When upgrading packages that have shadcn wrappers (recharts, react-day-picker, react-resizable-panels), update via `yarn dlx shadcn@latest add <component> --overwrite` to get compatible wrapper code
- Always run `yarn workspace web typecheck` after upgrades to catch breaking changes
- Prefer `^` prefix for dependency versions in package.json

## Code Style

- All git commits, PR titles, and branch names must be in **English**
- TypeScript strict mode is enabled across all workspaces
- ESLint with flat config (`eslint.config.mjs`)
