## Plan features

make purchase workflow to be more intuitive

# POS preferences and sales settings design

## Decision

Keep the main POS configuration in **Settings → POS Preferences**. Keep the gear dialog in `/sales/new` for **this sale only** and for quick operational overrides.

Do not create a second permanent POS-preferences page inside Sales. That would make users wonder whether a change applies to the current bill, their account, or the whole store.

## Information architecture

```text
Settings
└── POS Preferences
    ├── My workspace                 personal, account-specific
    │   ├── Show available stock
    │   ├── Keyboard shortcut hints
    │   ├── Confirm destructive actions
    │   └── Default Sales landing page
    ├── Store / counter setup        shared, owner-controlled
    │   ├── Accepted payment methods
    │   └── Show product locations
    └── Devices and receipts         shared defaults
        ├── Receipt printer
        ├── Receipt paper size
        ├── Cash drawer
        └── Open cash drawer after payment

Sales → New sale → Sale settings
└── Current sale / current counter overrides
    ├── Use POS defaults
    ├── Temporary printer override
    ├── Temporary paper-size override
    └── Temporary cash-drawer override
```

## Ownership and persistence

| Setting | Scope | Who can change it | Persistence |
| --- | --- | --- | --- |
| Keyboard hints, stock visibility, confirmation prompts | User workspace | Each signed-in user | Account preference |
| Default Sales landing page | User workspace | Each signed-in user | Account preference |
| Payment methods | Store / counter | Owner | Shared store setting |
| Product locations | Store / counter | Owner | Shared store setting |
| Printer, paper, cash drawer defaults | Store / counter | Owner | Shared store setting |
| Temporary device choice during a sale | Current sale | Authorized cashier | Until the sale ends |

## `/sales/new` behavior

The sales page should stay fast and uncluttered:

- The toolbar can show the active payment method and fulfillment choice.
- The Net total flow can require an explicit Cash/Bank transfer choice before opening the invoice breakdown.
- The gear button opens `Sale settings`, showing the current effective device setup.
- A small `Manage POS preferences` link should take the user to `/settings`, rather than duplicating the full settings form.
- If a user changes a value temporarily, label it clearly as `This sale only` and do not silently overwrite the store default.

## Recommended UI copy

- Global page: **POS Preferences**
- Shared section: **Store and counter setup**
- Device section: **Receipt and cash drawer defaults**
- In-sale dialog: **Sale settings**
- Temporary control: **Use for this sale only**
- Navigation link: **Manage POS preferences**

## Implementation direction

1. Keep `PosPreferences` for account-scoped UI behavior.
2. Keep `StorePosSettings` for owner-controlled shared POS behavior such as payment methods and product locations.
3. Move printer, paper, and cash-drawer defaults from component-local state into a persisted store POS settings model.
4. Let `SaleSettingsDialog` read those defaults and maintain an optional temporary override for the active sale.
5. Add an explicit `scope` or equivalent distinction in the UI wherever a setting can be changed, so users always know whether it affects their workspace, the store, or only the current sale.

## Acceptance criteria

- A user can find every permanent POS setting from `/settings`.
- No permanent setting is duplicated in `/sales/new`.
- Store-wide changes are owner-controlled and are reflected on the next sale without a page reload.
- A temporary sale override cannot accidentally change the store default.
- The sales page remains usable at a pharmacy counter without navigating away for normal checkout tasks.
