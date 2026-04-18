# Contributing to Marathon Bib Expo Frontend

First off, thank you for taking the time to contribute! Every contribution, big or small, is appreciated.

Please read this guide carefully before submitting issues or pull requests.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Branching Strategy](#branching-strategy)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Submitting a Pull Request](#submitting-a-pull-request)
- [Development Setup](#development-setup)
- [Code Standards](#code-standards)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it. Please report unacceptable behavior to the maintainers via GitHub.

---

## Branching Strategy

This project uses a two-branch model to keep the `master` branch stable at all times.

```
master          ← stable releases only; never commit directly here
  └── develop   ← integration branch; all feature/fix branches merge here first
        ├── feature/your-feature-name
        ├── fix/your-bug-fix-name
        └── chore/your-chore-name
```

**Rules:**

- `master` — contains only tested, stable code. Merges into `master` happen from `develop` after all tests pass and the change is verified.
- `develop` — the main working branch. All contributions target this branch.
- **Feature/fix branches** — always created from `develop`, never from `master`.
- A branch merges back into `develop` only after all CI checks and tests pass.
- `develop` is periodically merged into `master` as a release when it is stable.

**Branch naming convention:**

| Type            | Pattern                     | Example                     |
| --------------- | --------------------------- | --------------------------- |
| New feature     | `feature/short-description` | `feature/add-bib-search`    |
| Bug fix         | `fix/short-description`     | `fix/pagination-reset`      |
| Chore / tooling | `chore/short-description`   | `chore/update-dependencies` |

---

## How Can I Contribute?

### Reporting Bugs

Before submitting a bug report, please check the [existing issues](https://github.com/s-banerjee94/marathon-bib-expo-frontend/issues) to avoid duplicates.

When reporting a bug, include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Relevant screenshots, console errors, or network responses
- Environment details (OS, Node.js version, browser, etc.)

> Use the **bug** label when opening the issue.

### Suggesting Features

Feature requests are welcome. Open an issue with:

- A clear description of the feature and the problem it solves
- Any alternatives you have considered
- Additional context, mockups, or screenshots if applicable

> Use the **enhancement** label when opening the issue.

### Submitting a Pull Request

> **Important:** All contributions must branch off `develop`. PRs must target `develop`, **never `master`**. The `master` branch is reserved for stable releases and is only updated from `develop` once all tests pass.

1. **Fork** the repository to your own GitHub account.

2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/<your-username>/marathon-bib-expo-frontend.git
   cd marathon-bib-expo-frontend
   ```

3. **Add the upstream remote** to stay in sync with the main repository:

   ```bash
   git remote add upstream https://github.com/s-banerjee94/marathon-bib-expo-frontend.git
   ```

4. **Sync with upstream `develop`** before starting work:

   ```bash
   git fetch upstream
   git checkout -b feature/your-branch-name upstream/develop
   ```

5. Make your changes following the [Code Standards](#code-standards) below.

6. **Run tests and lint** before pushing:

   ```bash
   npm run lint
   npm test
   ```

7. **Push to your fork**:

   ```bash
   git push origin feature/your-branch-name
   ```

8. Open a **Pull Request** from your fork targeting the **`develop`** branch of the main repository.

9. In your PR description:
   - Reference the related issue (e.g. `Fixes #4`)
   - Explain what changed and why
   - Include screenshots if there are UI changes

10. Address any feedback from maintainers.

> Once the PR is merged into `develop` and all checks pass, maintainers will periodically merge `develop` into `master` as a stable release.

---

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Steps

```bash
# Install dependencies
npm install

# Configure the API base URL
# Edit src/app/shared/constants/api.constant.ts

# Start the dev server
npm start
```

Application runs at `http://localhost:4200`.

> You will also need the [Marathon Bib Expo Service](https://github.com/s-banerjee94/marathon-bib-expo-service) backend running locally or on your network.

---

## Code Standards

- **Standalone components** — never use NgModule. All components must have `standalone: true`.
- **Angular Signals** — use signals for reactive state; avoid RxJS for simple state that signals can handle.
- **Functional guards** — use `CanActivateFn` instead of class-based guards.
- **Lazy loading** — all new feature routes must use `loadComponent()`.
- **PrimeNG first** — always prefer PrimeNG components (inputs, buttons, dialogs, tables, dropdowns, etc.) over custom HTML elements.
- **Tailwind CSS only** — use Tailwind utility classes for all styling; never write custom CSS.
- **No color utility classes** — avoid `text-red-500`, `bg-blue-200`, `border-green-300`, etc. in Tailwind.
- **Shared constants** — never duplicate constants in individual components; use `src/app/shared/constants/` and `src/app/shared/models/`.
- **Error handling** — always use `ErrorHandlerService.showError()` in error callbacks; never implement custom error parsing.
- **No manual auth headers** — the `authInterceptor` adds the JWT automatically; never set `Authorization` headers manually.
- **BaseTableComponent** — extend `BaseTableComponent` when creating list views; call `initializeColumns()` in the constructor.
- **Explicit types** — always specify TypeScript types; avoid `any` where possible.
- **Comments** — only add comments where the logic is non-obvious; never explain what the code does.
- **Strict mode** — all TypeScript strict flags are enabled; ensure your changes compile cleanly with `npm run lint`.
