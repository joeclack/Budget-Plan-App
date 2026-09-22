# Budget domain and storage

## Records and boundaries

`src/domain/budget` contains pure TypeScript records, validation, evaluation and immutable document operations. It imports neither React nor SQLite. A document contains one calendar month (1-based month number), its groups and its rows. Stable IDs preserve references when labels, ordering or group membership change.

Each row can store an optional payment day from 1 to 31. Its complete date comes from the row's budget month. When the requested day does not exist, such as day 31 in February, the schedule uses the last day of that month. Only allocation rows appear in the upcoming list; informational totals remain display-only.

Allocation rows can also store an optional actual amount in pence. Actuals do not change planned totals. Remaining is planned minus actual. Display-only rows cannot record actuals. Copying a month or saving a template drops actuals so the new plan starts unspent. Carrying leftover into the next month adds last month's left-to-plan to the first savings allocation row, or creates a savings row if none exists.

The UI loads and saves through `BudgetRepository`. SQLite is the native source of truth; an edit is validated, committed, and read back before replacing the screen's document. The month picker converts its zero-based month index at the UI boundary.

Templates store a versioned detached structure. Copying a month or applying a template generates a new month ID and new group/row IDs and remaps every reference, including references inside nested arithmetic. There are no links to the source document. Copies start unlocked with revision zero.

Template management uses the template's update timestamp as a conflict token. Renaming keeps the saved structure. Updating from the current month replaces the structure with newly remapped group and row IDs. Deleting a template does not affect budget months that were previously created from it.

## Money and calculations

- Fixed amounts are safe integer pence. Decimal input is parsed as text, with at most two places. Blank and invalid input are rejected; explicit zero is valid.
- Percentage rates and expression literals are decimal strings. They do not accept exponent notation or JavaScript.
- Expressions are trees of literals, row/group references, and binary `+`, `-`, `*`, `/` operators. A literal is a pounds amount or scalar depending on the expression, e.g. `Salary / 2` halves the referenced pounds value. Parentheses correspond to nested trees.
- Intermediate arithmetic uses reduced BigInt fractions. Each calculated row rounds once to the nearest penny, with exact halves rounded away from zero (both 0.005 and -0.005 pounds round outward to one penny).
- A referenced row supplies its already-rounded penny value. Group totals and summaries add these integer pennies; they never add floating-point currency.
- A group's total includes only its `allocation` rows. `informational` rows display a calculation but contribute to neither that group's total nor the summary. A displayed subscriptions subtotal is informational while the underlying subscription items are allocations.
- Income is the sum of income groups. Allocated is the sum of expense and saving groups. Left to plan is income minus allocated. Negative balances are preserved.
- Missing references, circular row/group dependencies, division by zero, unsafe integer results and invalid rules return explicit errors. An error propagates to dependent amounts rather than becoming zero. Every row, including informational rows, must validate before saving.
- Data size/dependency depth limits reject unreasonable expressions or documents before a save. The engine never evaluates a rule as JavaScript.

## Transactional storage

The native repository uses bound SQL parameters and an isolated Expo exclusive transaction connection for each document operation. Operations sharing a database are queued; reads spanning multiple queries use a consistent snapshot. Related month, group and row writes commit or roll back together. Existing IDs are updated in place, preserving attached salary snapshots; deleted rows detach those snapshots.

Each month has a monotonically increasing revision. Draft edits preserve the loaded revision, and a save rejects a stale draft, a locked stored month, a duplicate calendar month, or another month's row/group IDs. The returned committed document supplies the next revision. Template updates use an advancing timestamp as their conflict token.

Schema version 2 adds revisions and lookup indices without deleting the version 1 tables or data. Version 3 adds the optional payment day. Migrations update the schema and version in one transaction. A database from a newer schema is refused. Expo exclusive transactions open a separate connection, so the repository explicitly checks foreign-key integrity before committing rather than relying solely on the provider connection's PRAGMA.

An empty installation remains empty until the user starts a month. Legacy generated example months are removed, while personal months and the selected month are preserved. Corrupt data is surfaced as an error and is never replaced.

## Verification

`npm test` covers exact rounding, percentage and nested arithmetic, negative totals, dynamic group membership, subtotal roles, cycles, missing references, division by zero, invalid inputs, safe limits, ID remapping, independent copies/templates, payment-date clamping and ordering, disk reopen, failed-save rollback, failed-migration rollback, migration from a frozen version 1 schema, stale writes, selected-month persistence and empty startup. Storage tests use actual SQLite databases, including separate transaction connections, rather than a mock SQL implementation.

Browser checks exercise editing salary and automatic percentage updates, reload, month copying and independence, template creation/application, persistent group creation, pay-estimate application and invalid amount cancellation. Browser persistence is a separate preview adapter; it does not substitute for physical iPhone bridge and keyboard checks.

Versioned reference: [Expo SDK 57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/).

# Milestone 3 editing workflow

Row and group forms build a separate draft and validate all dependent calculations before allowing Save. Rows can change name, notes, group, rule and allocation role together. Reordering retains IDs. Closing a form discards its draft. Successful saves update the displayed revision immediately; failure to remember the last-opened month cannot turn a committed edit into a stale draft.

Custom calculations support decimal numbers, `+ - * /`, unary signs and parentheses. The reference chooser inserts unique human-readable bracketed names which are resolved to stable row/group IDs on save. No JavaScript is evaluated. Text, token and nesting limits apply. Calculations use the existing exact penny-rounding engine.

Group-total rules initially use the display-only role to avoid counting the referenced money twice. A user can explicitly change that role. Deleting a group also removes its rows; the confirmation lists surviving rules that would break and blocks the deletion until those rules are edited. Safe deletions preview the changed totals.

Lock/unlock is a dedicated repository operation with an expected revision. It changes only lock state, modification time and revision. Ordinary saves cannot unlock a stored locked month, and stale lock operations are rejected. No schema migration is required for this milestone.
