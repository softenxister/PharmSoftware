# Pharm Agent Notes

Use these project rules for all future edits in this pharmacy retail software.

## Layout Stability

- Use rigid dimensions only where the workflow needs it, such as toolbar controls, fixed-format cards, summary bars, quantity controls, invoice rows, and customer fields.
- Item tables and item-entry areas may be flexible and extend naturally based on number of items or available desktop/tablet space.
- Do not let unusually long row values, customer names, phone/rank/point text, pack labels, or invoice values break alignment or create ugly layout jumps.
- Use fixed heights, min/max widths, `min-width: 0`, truncation, and ellipsis where needed, but avoid making every card or table rigid by default.
- Customer selected state should stay the same width and height as the empty customer field.
- Avoid UI shifting when a value changes from empty to populated.
- This software is designed for PC desktop and tablet pharmacy counters, not mobile-first phone layouts.
- Keep desktop/tablet layouts dense and ergonomic; do not over-optimize for narrow mobile screens at the cost of counter workflow.

## Null And Invalid Values

- Do not allow action buttons to run when required values are missing, null, invalid, NaN, empty, or zero.
- For sales, do not allow Save, Save & New, or Net Payable payment flow when there are no valid items or net payable is `0`, invalid, or NaN.
- Prefer both logic guards and disabled button styling.
- Pending payment bills must save enough item-line data to reopen the bill later.

## Sales Workflow

- Net Payable payment submit means the sale is paid.
- Top Save means pending payment/order, not paid.
- Print Receipt belongs after payment is received.
- Pending payment rows in `/sales` should reopen in `/sales/new` with the saved item list.

## Pharmacy Theme

- Keep the design quiet, modern, and suitable for retail pharmacy counter staff.
- Use shade-of-green pharmacy colors, but avoid shiny/neon green.
- Use restrained supporting colors only when useful, such as muted amber for pending and calm blue for invoice number.
- Keep the global font style consistent with the existing app.
- Prefer dense, practical POS layout over decorative or marketing-style UI.

## Form Controls

- Do not use native browser or OS dropdown styling for pharmacy app forms.
- Use custom searchable dropdown components like the pattern in `/sales/new`, especially for item, unit, packaging, category, manufacturer, and similar selectable fields.

## Verification

- Do not run npm commands unless the user explicitly asks.
- Use lightweight checks such as `git diff --check` after edits.
- For frontend changes, use the project `chrome-devtools` MCP server with its isolated browser profile when it is available.
- Visually verify changed screens at desktop and tablet widths, exercise the affected interactions, inspect the accessibility tree, and confirm the browser console has no errors or warnings.
- If browser verification is unavailable, say so explicitly and do not claim that the UI was visually verified.
