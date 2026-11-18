## Proposal

### Please re-state the problem that we are trying to solve in this issue.

When a user selects a saved search on the mobile (narrow layout) Search page, the correct search filters are applied but the saved search tab does not visually highlight as active. Instead, the corresponding built-in tab (e.g., "Expenses", "Chats") gets highlighted, making it unclear which search is actually selected.

### What is the root cause of that problem?

In `src/pages/Search/SearchPageTabSelector.tsx`, the `activeKey` variable is set in two places as tabs are built:

1. **Saved search match** -- inside the `savedSearchesTabItems` mapping, `activeKey` is correctly set when `queryJSON.hash` matches a saved search key:
   ```typescript
   if (queryJSON && Number(key) === queryJSON.hash) {
       activeKey = key;
   }
   ```

2. **Built-in tab match** -- inside the `typeMenuSections` loop for built-in items, `activeKey` is **unconditionally overwritten** when `similarSearchHash` matches:
   ```typescript
   if (queryJSON && item.similarSearchHash === queryJSON.similarSearchHash) {
       activeKey = item.key;
   }
   ```

Because `similarSearchHash` only considers `type`, `status`, `groupBy`, and `policyID` (excluding `sort`, `view`, `columns`, and other saved-search-specific parameters), a saved search will almost always match the `similarSearchHash` of its corresponding built-in tab. Since the built-in items are processed **after** saved search items (saved searches are pushed into `tabItems` first via the `'search.savedSearchesMenuItemTitle'` section), the built-in match overwrites the correct saved search `activeKey`.

The desktop/wide layout avoids this problem because `useSearchTypeMenuSections.ts` uses an `isSavedSearchActive` guard to skip the built-in item matching when a saved search is active.

### What changes do you think we should make in order to fix the problem?

**File:** `src/pages/Search/SearchPageTabSelector.tsx`

Add a guard condition `!activeKey` before the built-in item's `similarSearchHash` check, so it only sets `activeKey` for a built-in tab if no saved search has already claimed it:

```diff
- if (queryJSON && item.similarSearchHash === queryJSON.similarSearchHash) {
+ if (!activeKey && queryJSON && item.similarSearchHash === queryJSON.similarSearchHash) {
      activeKey = item.key;
  }
```

This is a minimal, safe change:
- If a saved search matched `queryJSON.hash`, `activeKey` is already set and the built-in item will not overwrite it.
- If no saved search matched, `activeKey` is still `''` (falsy), so the built-in item matching proceeds as before.
- This mirrors the guard pattern already used in the desktop layout's `useSearchTypeMenuSections.ts`.

No other files need to change. The fix is a single line addition of `!activeKey &&` to the existing condition.

### What alternative solutions did you explore? (Optional)

An alternative is to compute an explicit `isSavedSearchActive` boolean (matching the desktop pattern in `useSearchTypeMenuSections.ts`) and use that as the guard:

```typescript
const isSavedSearchActive = queryJSON?.hash !== undefined && !!savedSearches &&
    Object.keys(savedSearches).some((key) => Number(key) === queryJSON.hash);
```

Then:
```typescript
if (!isSavedSearchActive && queryJSON && item.similarSearchHash === queryJSON.similarSearchHash) {
    activeKey = item.key;
}
```

However, this is functionally equivalent to checking `!activeKey` since the saved search loop already sets `activeKey` when the hash matches. The simpler `!activeKey` guard achieves the same result with less code and no additional computation.
