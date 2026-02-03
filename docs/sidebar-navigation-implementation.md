# Sidebar Navigation Implementation

This document explains the implementation of the sidebar navigation system with mobile/tablet drawer support, theme configuration, and layout management.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Component Details](#component-details)
5. [Styling & Responsive Design](#styling--responsive-design)
6. [Code Explanation](#code-explanation)

---

## Overview

The sidebar navigation system provides:

- **Static sidebar** on desktop (always visible, pushes content)
- **Drawer/overlay sidebar** on mobile and tablet (slides in from left)
- **Theme configuration** with multiple presets, primary colors, and surface palettes
- **Dark mode support** with persistent preferences
- **Role-based menu filtering** based on user permissions
- **Smooth animations** and touch-friendly interactions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        App Component                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │     Navbar      │  │    Sidebar      │  │    Main     │ │
│  │ (Theme Toggle,  │  │ (Navigation     │  │  Content    │ │
│  │  Menu Toggle)   │  │  Drawer)        │  │  (Router)   │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┘ │
│           │                    │                            │
│           │    ┌───────────────┴───────────────┐            │
│           │    │         Menu Component        │            │
│           │    │    (Role-filtered items)      │            │
│           │    └───────────────┬───────────────┘            │
│           │                    │                            │
│           │    ┌───────────────┴───────────────┐            │
│           │    │      MenuItem Component       │            │
│           │    │   (Recursive, expandable)     │            │
│           │    └───────────────────────────────┘            │
│           │                                                 │
│           └─────────────┐                                   │
│                         ▼                                   │
│              ┌─────────────────────┐                        │
│              │   LayoutService     │                        │
│              │ (State Management)  │                        │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── app/
│   ├── app.ts                          # Root component with layout classes
│   ├── app.html                        # Main layout template
│   ├── app.config.ts                   # App configuration with PrimeNG theme
│   │
│   ├── components/
│   │   ├── sidebar/
│   │   │   ├── sidebar.ts              # Sidebar container component
│   │   │   └── sidebar.html            # Sidebar template with <nav> element
│   │   │
│   │   ├── menu/
│   │   │   ├── menu.ts                 # Menu with role-based filtering
│   │   │   └── menu.html               # Menu list template
│   │   │
│   │   ├── menuitem/
│   │   │   ├── menuitem.ts             # Individual menu item (recursive)
│   │   │   └── menuitem.html           # Menu item with submenu support
│   │   │
│   │   ├── navbar/
│   │   │   ├── navbar.ts               # Top navigation bar
│   │   │   └── navbar.html             # Navbar with menu toggle, theme controls
│   │   │
│   │   └── theme-configurator/
│   │       ├── theme-configurator.ts   # Theme settings panel
│   │       └── theme-configurator.html # Color/preset selection UI
│   │
│   ├── core/
│   │   └── services/
│   │       └── layout.service.ts       # Layout state & theme management
│   │
│   └── shared/
│       ├── constants/
│       │   └── storage-keys.constant.ts  # LocalStorage key definitions
│       └── models/
│           └── menu.model.ts           # Menu item interface definition
│
├── styles.css                          # Global layout & sidebar styles
└── index.html                          # HTML entry point
```

---

## Component Details

### 1. LayoutService (`layout.service.ts`)

**Purpose:** Central state management for layout configuration and theme settings.

**Key Features:**

```typescript
// State signals
layoutConfig = signal<LayoutConfig>({...});  // Theme preferences
layoutState = signal<LayoutState>({...});    // Menu visibility state

// Computed values
isDarkTheme = computed(() => this.layoutConfig().darkTheme);
isSidebarActive = computed(() => {...});     // Determines if sidebar is visible
```

**LayoutConfig Interface:**

```typescript
interface LayoutConfig {
  preset: string; // 'Aura', 'Lara', 'Material', 'Nora'
  primary: string; // Primary color name (e.g., 'emerald')
  surface: string | null; // Surface palette name (e.g., 'slate')
  darkTheme: boolean; // Dark mode enabled
  menuMode: 'static' | 'overlay'; // Sidebar behavior
}
```

**LayoutState Interface:**

```typescript
interface LayoutState {
  staticMenuDesktopInactive: boolean; // Desktop: sidebar collapsed
  overlayMenuActive: boolean; // Overlay mode: sidebar open
  mobileMenuActive: boolean; // Mobile: drawer open
}
```

**Key Methods:**

| Method             | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `onMenuToggle()`   | Toggles sidebar based on device type (desktop vs mobile) |
| `hideMenu()`       | Closes the sidebar/drawer                                |
| `isDesktop()`      | Returns `true` if `window.innerWidth > 991`              |
| `isMobile()`       | Returns `true` if not desktop                            |
| `toggleDarkMode()` | Toggles dark/light theme                                 |
| `updateColors()`   | Updates primary or surface color palette                 |
| `applyPreset()`    | Applies a PrimeNG theme preset                           |

---

### 2. App Component (`app.ts`)

**Purpose:** Root component that manages layout classes and body scroll locking.

**Key Code:**

```typescript
// Computed layout classes based on state
layoutClasses = computed(() => {
  const config = this.layoutService.layoutConfig();
  const state = this.layoutService.layoutState();

  return {
    'layout-static': config.menuMode === 'static',
    'layout-overlay': config.menuMode === 'overlay',
    'layout-static-inactive': state.staticMenuDesktopInactive,
    'layout-mobile-active': state.mobileMenuActive,
    'layout-overlay-active': state.overlayMenuActive,
  };
});

// Effect to block body scroll when drawer is open
constructor() {
  effect(() => {
    const state = this.layoutService.layoutState();
    if (state.mobileMenuActive || state.overlayMenuActive) {
      document.body.classList.add('blocked-scroll');
    } else {
      document.body.classList.remove('blocked-scroll');
    }
  });
}
```

**Template (`app.html`):**

```html
<div class="layout-wrapper" [ngClass]="layoutClasses()">
  <app-navbar></app-navbar>

  @if (isAuthenticated()) {
  <app-sidebar></app-sidebar>
  @if (layoutService.layoutState().mobileMenuActive) {
  <div class="layout-mask" (click)="onMaskClick()"></div>
  } }

  <main class="layout-main">
    <router-outlet></router-outlet>
  </main>
</div>
```

---

### 3. Sidebar Component (`sidebar.ts`)

**Purpose:** Container for the navigation menu with route change handling.

**Key Features:**

- Listens for route changes and auto-closes sidebar on mobile
- Prevents click events from bubbling to mask overlay

```typescript
constructor() {
  // Auto-close sidebar on mobile navigation
  this.routerSubscription = this.router.events
    .pipe(filter((event) => event instanceof NavigationEnd))
    .subscribe(() => {
      if (this.layoutService.isMobile()) {
        this.layoutService.hideMenu();
      }
    });
}

onSidebarClick(event: MouseEvent): void {
  // Prevent click from closing sidebar via mask
  event.stopPropagation();
}
```

**Template (`sidebar.html`):**

```html
<nav
  class="layout-sidebar"
  role="navigation"
  aria-label="Main navigation"
  (click)="onSidebarClick($event)"
>
  <app-menu></app-menu>
</nav>
```

---

### 4. Menu Component (`menu.ts`)

**Purpose:** Renders the navigation menu with role-based filtering.

**Key Features:**

- Filters menu items based on user's role
- Uses computed signal for reactive filtering

```typescript
private readonly menuItems: AppMenuItem[] = [
  {
    label: 'Dashboard',
    icon: 'pi pi-home',
    routerLink: this.authService.getDashboardRoute(),
    roles: [UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN, ...],
  },
  {
    label: 'Management',
    icon: 'pi pi-cog',
    roles: [UserRole.ROOT, UserRole.ADMIN],
    items: [  // Submenu
      { label: 'Users', icon: 'pi pi-users', routerLink: '/users' },
      { label: 'Organizations', icon: 'pi pi-building', routerLink: '/organizations' },
    ],
  },
  // ...more items
];

// Reactive filtering based on user role
filteredMenu = computed(() => {
  const userRole = this.authService.getCurrentRole();
  if (!userRole) return [];
  return this.filterMenuByRole(this.menuItems, userRole);
});
```

---

### 5. MenuItem Component (`menuitem.ts`)

**Purpose:** Recursive component for individual menu items with submenu support.

**Key Features:**

- Handles active state detection based on current route
- Supports nested submenus with expand/collapse animation
- Auto-expands parent when child route is active

```typescript
// Signals for component state
isActive = signal(false);    // Is this item's route active?
isExpanded = signal(false);  // Is submenu expanded?

// Check if item has children
get hasSubmenu(): boolean {
  return !!this.item().items && this.item().items!.length > 0;
}

// Handle route changes
private updateActiveStateForItem(item: AppMenuItem, url: string): void {
  const itemLink = item.routerLink;
  if (itemLink) {
    // Check if current URL matches or starts with item's route
    this.isActive.set(url === itemLink || url.startsWith(itemLink + '/'));
  }

  // Auto-expand parent if child is active
  if (hasSubmenu && hasActiveChild) {
    this.isExpanded.set(true);
  }
}

// Toggle submenu or navigate
onItemClick(event: Event): void {
  if (this.hasSubmenu) {
    this.toggleSubmenu(event);
  } else if (this.layoutService.isMobile()) {
    this.layoutService.hideMenu();  // Close drawer on mobile navigation
  }
}
```

---

### 6. Navbar Component (`navbar.ts`)

**Purpose:** Top navigation bar with menu toggle, theme controls, and user menu.

**Key Elements:**

- Hamburger menu button (toggles sidebar)
- Dark mode toggle button
- Theme configurator popover
- User avatar with dropdown menu

```typescript
onMenuToggle(event: Event): void {
  event.stopPropagation();
  this.layoutService.onMenuToggle();
}
```

---

### 7. Theme Configurator (`theme-configurator.ts`)

**Purpose:** UI panel for selecting theme colors and presets.

**Features:**

- Primary color selection (16 colors + noir)
- Surface palette selection (8 palettes)
- Preset selection (Aura, Lara, Material, Nora)

```typescript
updateColors(event: Event, type: 'primary' | 'surface', color: SurfacePalette): void {
  this.layoutService.updateColors(type, color);
  event.stopPropagation();
}

onPresetChange(preset: string): void {
  this.layoutService.applyPreset(preset);
}
```

---

### 8. Menu Model (`menu.model.ts`)

**Purpose:** TypeScript interface for menu item structure.

```typescript
export interface AppMenuItem {
  label: string; // Display text
  icon?: string; // PrimeIcons class (e.g., 'pi pi-home')
  routerLink?: string; // Route path
  items?: AppMenuItem[]; // Child items (submenu)
  roles?: UserRole[]; // Allowed roles (empty = all)
  separator?: boolean; // Render as separator line
  badge?: string; // Badge text
  badgeClass?: string; // Badge CSS class
}
```

---

## Styling & Responsive Design

### CSS Variables (`styles.css`)

```css
:root {
  --sidebar-width: 250px; /* Desktop sidebar width */
  --sidebar-width-mobile: 320px; /* Mobile drawer width */
  --topbar-height: 56px; /* Navbar height */
  --layout-transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); /* Smooth easing */
}
```

### Layout Classes

| Class                     | Description                              |
| ------------------------- | ---------------------------------------- |
| `.layout-static`          | Desktop: sidebar visible, content offset |
| `.layout-static-inactive` | Desktop: sidebar hidden                  |
| `.layout-overlay`         | Overlay mode: sidebar hidden by default  |
| `.layout-overlay-active`  | Overlay mode: sidebar visible            |
| `.layout-mobile-active`   | Mobile: drawer visible                   |

### Sidebar Styles

```css
.layout-sidebar {
  position: fixed;
  top: var(--topbar-height);
  left: 0;
  width: var(--sidebar-width);
  height: calc(100vh - var(--topbar-height));
  overflow-y: auto;
  z-index: 998;
  transition:
    transform var(--layout-transition),
    box-shadow var(--layout-transition);
  background-color: var(--p-surface-0);
  border-right: 1px solid var(--p-surface-200);
}

/* Hidden state */
.layout-static-inactive .layout-sidebar,
.layout-overlay .layout-sidebar {
  transform: translateX(-100%);
}

/* Visible state */
.layout-static .layout-sidebar,
.layout-overlay-active .layout-sidebar,
.layout-mobile-active .layout-sidebar {
  transform: translateX(0);
}
```

### Mobile/Tablet Responsive Styles

```css
@media (max-width: 991px) {
  .layout-sidebar {
    width: var(--sidebar-width-mobile); /* Wider for touch */
    max-width: 85vw; /* Responsive limit */
    transform: translateX(-100%); /* Hidden by default */
    border-right: none;
  }

  .layout-mobile-active .layout-sidebar {
    transform: translateX(0);
    /* Drawer shadow for depth effect */
    box-shadow:
      4px 0 6px -1px rgba(0, 0, 0, 0.1),
      8px 0 15px -3px rgba(0, 0, 0, 0.15);
  }

  .layout-main {
    margin-left: 0 !important; /* Full width on mobile */
  }
}

/* Small mobile devices */
@media (max-width: 480px) {
  .layout-sidebar {
    width: 85vw;
    max-width: 300px;
  }
}

/* Touch-friendly menu items */
@media (max-width: 991px) {
  .menu-link {
    padding: 0.875rem 1rem;
    min-height: 48px; /* Touch target size */
  }
}
```

### Overlay Mask

```css
.layout-mask {
  position: fixed;
  top: var(--topbar-height);
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 997;
  cursor: pointer;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

---

## Code Explanation

### How the Drawer Works

1. **User taps hamburger menu** → `onMenuToggle()` in Navbar
2. **LayoutService detects mobile** → Sets `mobileMenuActive: true`
3. **App component reacts** → Adds `layout-mobile-active` class
4. **CSS transforms sidebar** → `translateX(0)` shows drawer
5. **Mask appears** → With fade-in animation
6. **User taps mask** → `onMaskClick()` calls `hideMenu()`
7. **Sidebar closes** → `translateX(-100%)` hides drawer

### Theme Persistence

1. **On load:** LayoutService reads from `localStorage` via `loadConfig()`
2. **On change:** Effect in LayoutService calls `saveConfig()` and `applyDarkMode()`
3. **Storage key:** `marathon_layout_config` (defined in `STORAGE_KEYS`)

### Role-Based Menu Filtering

1. **Menu items define `roles` array** (allowed roles)
2. **Menu component gets current role** from `AuthService.getCurrentRole()`
3. **`filterMenuByRole()` recursively filters** items and submenus
4. **Computed signal updates** when user role changes

---

## Configuration

### angular.json Changes

Build budget increased to accommodate theme libraries:

```json
{
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "1MB",
      "maximumError": "2MB"
    }
  ]
}
```

### app.config.ts - PrimeNG Theme

```typescript
providePrimeNG({
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.app-dark',  // CSS class for dark mode
    },
  },
}),
```

---

## Summary

This implementation provides a complete sidebar navigation system that:

- Works seamlessly across desktop, tablet, and mobile devices
- Supports multiple theme presets and color customization
- Persists user preferences in localStorage
- Filters menu items based on user role
- Uses Angular signals for reactive state management
- Follows accessibility best practices with ARIA attributes
