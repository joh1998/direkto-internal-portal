# Direkto Internal Admin Website — System Guidelines (AI UI Designer)

## 0) Product scope (what you are designing)
This is an internal admin website for Direkto operations. It is not a consumer app.
Primary jobs:
- Monitor live trips (map + timeline)
- Manage POIs on a map (create/edit/verify/deactivate/delete, anchors, media)
- Approve/manage merchants + commission
- Approve/manage drivers + documents + vehicles
- Manage users (search, ban/unban)
- Manage rentals/bookings status
- Finance reports + payouts summary
- Team admin users + roles + activity logs
- Settings editor + CSV exports + notifications

Design goal: **Apple-clean, fast scanning, data-dense but calm**.

---

## 1) Information architecture & navigation (required)
### Global layout
- Use a **left sidebar** (primary navigation).
- Use a **top bar** for: global search, notifications bell, current admin profile, quick actions.
- Each page uses:
  - Page title + short subtitle
  - Filter row (chips + date range + status)
  - Main content (table/chart/map)
  - Right-side **Detail Drawer** for “view/edit” without losing context

### Sidebar groups (exact)
1. Overview
   - Dashboard
2. Operations
   - POI Map (⭐ centerpiece)
   - Trips (Live)
   - Bookings (Rentals)
3. Directory
   - Merchants
   - Drivers
   - Users
4. Finance
   - Finance & Reports
   - Exports
5. Admin
   - Team
   - Settings

### Route + page templates (must exist)
- Login
- Dashboard (KPI cards + revenue trend chart + activity feed)
- POI Map (Map + list + edit drawer)
- Merchants (approval queue + detail + commission editor)
- Drivers (approval queue + detail + suspend/reactivate + documents)
- Users (search table + user detail + ban/unban)
- Trips Live (real-time active trips map + trip table + trip detail + timeline)
- Bookings (rental booking table + status actions)
- Finance (summary + commission report + revenue trend + payouts)
- Team (admin users + role assignment + activity log)
- Settings (key/value editor with audit)
- Exports (download center for CSV)
- Notifications (inbox + unread count badge)

---

## 2) Roles & permissions (RBAC UI contract)
- The UI MUST gate:
  - Sidebar items
  - Table actions (approve/reject/suspend/cancel/export)
  - Edit forms and destructive actions
- Always show current role + permission scope in profile menu (read-only).
- If user lacks permission:
  - Hide the action OR show disabled with tooltip: “Requires X permission”.

---

## 3) Design language (Apple-like)
### Visual rules
- Minimal, “content-first”.
- Prefer whitespace + alignment over borders.
- Use cards only for KPI summary + small groups; do NOT turn the whole UI into card soup.
- Favor **detail drawers** over navigation-heavy multi-page editing.

### Dark Mode
- Respect system appearance; do not add an in-app dark mode toggle.
- Ensure every component works in Light + Dark + Auto.

### Color usage
- Use semantic color tokens (text, background, separator, status).
- Use color sparingly for emphasis:
  - Primary action
  - Status chips (Verified / Pending / Suspended / Cancelled)
  - Alerts and destructive actions
- Never rely on color alone for status (always pair with text/icon).

### Icons
- Prefer SF Symbols-style glyphs (simple, consistent stroke).
- Use consistent icon size and optical alignment.
- All icons must have accessible labels (aria-label / alt / tooltip).
- Avoid decorative icons that don’t add meaning.

### Layout & spacing
- Use consistent spacing and alignment to preserve scan-ability.
- Use progressive disclosure:
  - Keep the main list/map simple
  - Put advanced fields/actions behind “More”, collapsible sections, or drawers
- Backgrounds should extend edge-to-edge; navigation surfaces sit “above” content.

### Copywriting (internal tool tone)
- Use plain language.
- Avoid slang/humor.
- Define technical terms the first time they appear (tooltip or helper text).
- Labels are verbs: “Approve”, “Reject”, “Suspend driver”, “Cancel trip”.

---

## 4) Core components (must implement)
### Page Shell
- Sidebar (collapsible)
- Top bar (search + notifications + profile)
- Breadcrumbs (optional, only when deep detail pages exist)
- Toast system (success/error)
- Global loading + skeleton states

### Data Table (workhorse)
- Sticky header row
- Column sorting
- Column visibility toggle (power users)
- Pagination + page size
- Row selection + bulk actions (only where spec supports bulk)
- Row actions menu (…)
- Quick status chips inside rows

### Filter Bar
- Search input (debounced)
- Status chips
- Date range (for trips/bookings/finance)
- Area filters (city/barangay/service area) where relevant

### Detail Drawer (standard)
- Opens from right
- Tabs inside drawer when needed:
  - Overview | Activity | Documents | Commission | Timeline
- Sticky footer actions:
  - Primary action (Save / Approve)
  - Secondary (Cancel)
  - Destructive (Delete / Suspend) separated and requires confirm

### Confirm dialogs (safety)
Required for:
- Cancel trip
- Reject merchant/driver
- Suspend driver / ban user
- Delete POI / delete media
Dialog must show:
- Object name + ID
- Impact warning
- Confirm requires explicit click (no “Enter to destroy” default)

---

## 5) Module UI contracts (page-by-page)

### A) Login
- Email + password
- Error states:
  - Invalid credentials
  - Account disabled
- After login, route based on permissions (default: Dashboard)

### B) Dashboard
- KPI cards: merchants, drivers, users, trips, revenue
- Revenue trend chart
- Top merchants list
- Activity feed

### C) POI Map (⭐ centerpiece)
Layout:
- Left: POI list panel (search + filters)
- Center: MapLibre map
- Right: POI drawer (view/edit)

Must support:
- Create POI (map click → form)
- Edit POI fields
- Verify / Deactivate toggles
- Delete POI (confirm)
- Anchors:
  - Create anchor
  - Drag/move anchor on map
  - Set default anchor
  - Verify anchor
- Media manager:
  - Upload cover/icon/gallery
  - Reorder gallery via drag
  - Delete media

Map behaviors:
- Clustering for dense areas
- Hover/selection state for markers
- “Nearest anchor” helper when placing anchors
- “Nearby POIs” helper for validation (avoid duplicates)

### D) Merchants
- Two primary views:
  1) Pending queue (Approve/Reject)
  2) All merchants (search/filter)
- Merchant detail drawer:
  - Status
  - Stats
  - Commission config editor:
    - Contract / rate updates
    - Temporary override
    - Commission history timeline

### E) Drivers
- Pending queue + all drivers
- Driver detail:
  - Status
  - Performance stats
  - Trip history
  - Earnings summary
  - Documents viewer (download/preview)
  - Vehicles list
- Suspend/reactivate actions require confirm + reason text area

### F) Users
- Search/filter table
- User detail
- Ban/unban + edit user fields (if allowed)

### G) Trips (Live)
- Split view:
  - Map of active trips
  - Trips table (status, driver, user, fare, time)
- Trip detail:
  - Timeline events
  - Admin cancel trip (confirm)

### H) Bookings (Rentals)
- Search + stats
- Booking detail
- Update status + cancel booking (confirm)

### I) Finance & Reports
- Summary cards
- Commission report
- Revenue trend chart
- Commission-by-tier breakdown
- Payout summary
- Export actions are grouped here and also in Exports page

### J) Exports
- Download center:
  - Merchants CSV
  - Bookings CSV
  - Commission report CSV
- Each export shows:
  - Description
  - Date range selector if supported
  - “Generate” then “Download”

### K) Team
- Admin members table
- Create admin (assign role)
- Edit admin (change role)
- Remove admin (confirm)
- Activity log (filterable)

### L) Settings
- Key/value editor
- Change history + who changed it (audit)
- Dangerous settings require confirm + reason

### M) Notifications
- Bell in top bar shows unread badge
- Inbox page:
  - List + read state
  - Mark as read / read all

---

## 6) Data & status design (must be consistent)
### Status chips (standard set)
- Pending
- Approved / Verified
- Active
- Inactive / Deactivated
- Suspended
- Cancelled
- Failed

### Empty states
- Always explain “why empty” + next action:
  - “No pending merchants. Check ‘All merchants’.”

### Error states
- Inline field errors for forms
- Page-level error banner for fetch failures
- Retry button + error ID (for support)

---

## 7) Accessibility & inclusion checklist
- Keyboard navigable sidebar, tables, drawers
- Visible focus states
- All icons have accessible labels
- Don’t rely on color alone for meaning
- Plain language, define technical terms
- Use gender-neutral language in UI copy

---

## 8) Output format (what you must generate)
When generating UI:
- Provide desktop-first responsive layout (works 1280px+)
- Provide component inventory (what components are needed)
- Provide page-by-page wireframe structure
- Provide interaction notes for map + drawers + tables
- Provide states: loading / empty / error / success
