
## Fix: "Gerar Plano Padrao" dialog stuck on "Verificando lancamentos vinculados"

### Root Cause

The initialization logic (checking if there's existing data, deciding which step to show) lives inside `handleOpen`, which is passed as `onOpenChange` to `AlertDialog`. However, `onOpenChange` only fires when the dialog itself triggers a state change (clicking the backdrop, pressing Escape). It does NOT fire when the parent component sets `open={true}` via the button click.

As a result, the `step` state stays at its initial value `"checking"` and the spinner runs forever.

### Solution

Move the initialization logic into a `useEffect` that watches the `open` prop. When `open` becomes `true`, determine the correct step. The `onOpenChange` will only handle closing (passing through to the parent).

### Technical Details

**File: `src/components/SeedPlanDialog.tsx`**

1. Add a `useEffect` that runs when `open` changes to `true`:
   - Reset `confirmCheck`, `confirmText`, `loading`
   - If `!hasExistingData` (no accounts and no cost centers), set step to `"no-data"` immediately
   - Otherwise, run the linked transactions check with the existing 5-second timeout, falling back to `"safe-replace"`

2. Simplify `onOpenChange` to just pass through to the parent (no async logic):
   ```
   onOpenChange={onOpenChange}
   ```

This ensures the step logic always runs when the dialog opens, regardless of how it's triggered.
