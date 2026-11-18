## Proposal

### Please re-state the problem that we are trying to solve in this issue.

The Home page's `ForYouSection/EmptyState` component occasionally displays a legacy "Fireworks" illustration (`product-illustrations/fireworks.svg`, designed at 164x148px) that appears visually inconsistent when rendered at 68x68px alongside the modern `simple-illustrations/` set. This creates a jarring visual mismatch in the empty state.

### What is the root cause of that problem?

In `src/components/Icon/chunks/illustrations.chunk.ts`, the `Fireworks` illustration is imported from the legacy `product-illustrations/` directory:

```typescript
import Fireworks from '@assets/images/product-illustrations/fireworks.svg';
```

Unlike the other 15 illustrations used in the `ForYouSection/EmptyState` component (e.g., `ThumbsUpStars`, `SmallRocket`, `Flash`), which all have matching `simple-illustrations/simple-illustration__*.svg` assets designed at the correct 68x68px size, `Fireworks` has no simple-illustration equivalent. When the EmptyState component includes `Fireworks` in its `ILLUSTRATIONS` array, it resolves to the large legacy asset and forces it into a 68x68 box, producing a blurry, out-of-place graphic.

The core issue is that `Fireworks` lacks a `simple-illustrations/simple-illustration__fireworks.svg` counterpart, so any consumer requesting the `Fireworks` illustration at small sizes gets the wrong asset.

### What changes do you think we should make in order to fix the problem?

**Option A (recommended -- remove Fireworks from the array):**

Since creating a new SVG asset requires design work and the other 15 illustrations provide sufficient variety, the cleanest code-only fix is to remove `Fireworks` from the EmptyState illustrations array.

**File:** `src/pages/home/ForYouSection/EmptyState.tsx`

Remove `'Fireworks'` from the `ILLUSTRATIONS` array if it is present. Based on the issue description, the array should contain only these 15 entries that have proper simple-illustration assets:

```typescript
const ILLUSTRATIONS = [
    'ThumbsUpStars',
    'SmallRocket',
    'CowboyHat',
    'Trophy1',
    'PalmTree',
    'FishbowlBlue',
    'Target',
    'Chair',
    'Broom',
    'House',
    'ConciergeBot',
    'CheckboxText',
    'Flash',
    'Sunglasses',
    'F1Flags',
] as const;
```

Additionally, remove the now-unused translation keys from the English locale file:

**File:** `src/languages/en.ts` (and `src/languages/es.ts` for Spanish)

Remove the `fireworksTitle` and `fireworksDescription` keys from the `homePage.forYouSection.emptyStateMessages` object.

**Option B (comprehensive -- create a new asset):**

Create a new `assets/images/simple-illustrations/simple-illustration__fireworks.svg` at 68x68px matching the visual language of sibling simple-illustrations (flat style, consistent stroke width, limited color palette). Then update the illustration chunk to import from the new path:

**File:** `src/components/Icon/chunks/illustrations.chunk.ts`

```diff
- import Fireworks from '@assets/images/product-illustrations/fireworks.svg';
+ import Fireworks from '@assets/images/simple-illustrations/simple-illustration__fireworks.svg';
```

This would allow `Fireworks` to remain in the EmptyState array and would also fix any other consumers of the `Fireworks` illustration that render at small sizes.

Option B is the more thorough fix but requires a designer to create the new SVG asset. Option A is a pure code change that can be shipped immediately.

### What alternative solutions did you explore? (Optional)

A third approach would be to add a size check or conditional import in the EmptyState component itself, loading the simple-illustration version when available and falling back gracefully. However, this adds unnecessary complexity when the simpler approach of either removing the entry or providing the correct asset solves the problem completely.
