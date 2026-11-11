# Help Center Accordion

_Format: 60 minutes, frontend. Parts are revealed one at a time. Don't read ahead._

Build a reusable **compound `Accordion` component** in `src/components/Accordion.tsx`, then use it in `App.jsx` to render the help center from [src/faq.ts](src/faq.ts).

Rules:

- No UI libraries.
- `Accordion`'s children are arbitrary JSX. **Don't** use `React.Children.map` or `cloneElement` to pass props down. Sub-components get what they need from context.
- Styling doesn't matter. An open/closed indicator (▸ / ▾) is enough.

## Run

```sh
npm install
npm run dev
```

---

## Part 1: Basic compound API (~15 min)

The help center should be usable like this:

```jsx
<Accordion>
  <Accordion.Item value="late">
    <Accordion.Trigger>My order is late. What can I do?</Accordion.Trigger>
    <Accordion.Content>Check live tracking in the app…</Accordion.Content>
  </Accordion.Item>
  <Accordion.Item value="missing">
    <div className="row">               {/* wrappers must not break anything */}
      <Accordion.Trigger>An item is missing</Accordion.Trigger>
    </div>
    <Accordion.Content>Open the order…</Accordion.Content>
  </Accordion.Item>
</Accordion>
```

Requirements:

- Only **one** item is open at a time. Clicking the open item's trigger closes it.
- `Trigger` and `Content` don't receive `value` as a prop. They have to work out which item they belong to.
- If `Accordion.Item`, `Trigger`, or `Content` is rendered outside its parent, throw a clear error, for example `"Accordion.Trigger must be used inside <Accordion.Item>"`.
- Render one accordion per FAQ section.

> Think: how many contexts do you need, and what does each one hold?

---

## Part 2: Modes and controlled state (~15 min)

Add these props to `Accordion`:

| Prop | Type | Behavior |
| --- | --- | --- |
| `type` | `"single" \| "multiple"` | `"multiple"` lets any number of items be open. Default `"single"`. |
| `defaultValue` | `string \| string[]` | Initially open item(s) when **uncontrolled**. |
| `value` | `string \| string[]` | When passed, the accordion is **controlled**: the parent owns the open state. |
| `onValueChange` | `(value) => void` | Fires on every change in either mode. |

Add `disabled` to `Accordion.Item`. A disabled item can't be toggled, and its trigger shows as disabled. The gift card FAQ is disabled.

In `App`, make the **Payments** section controlled. Put a "Show refund info" button **outside** the accordion that opens `refund-time`.

---

## Part 3: Accessibility and keyboard (~15 min)

- `Trigger` is a `<button>` with `aria-expanded` and `aria-controls` pointing at its content.
- `Content` has `role="region"`, an `id`, and `aria-labelledby` pointing back at the trigger. Use `useId`, not the `value`, because two accordions on the page could reuse the same values.
- While a trigger has focus:
  - **ArrowDown / ArrowUp**: move focus to the next or previous trigger, wrapping around.
  - **Home / End**: move focus to the first or last trigger.
  - Focus moves only between triggers in **this** accordion and **skips disabled** items.

> Think: how does a trigger know about its siblings, and in what order, when it can't see them?

---

## Part 4: Nesting and accordion-wide controls (~15 min)

1. Wrap everything in an outer accordion where each **section** is an item, and the inner FAQ accordion sits inside that section's `Content`.
   - The inner and outer accordions must stay fully independent. Opening an FAQ must not affect the sections, and arrow keys inside an inner accordion stay inside it.
2. Add an `<Accordion.Toolbar />` sub-component that can be rendered **anywhere inside** an `Accordion`, at any depth. It shows:
   - `"2 of 3 open"`
   - an **Expand all** button, visible only for `type="multiple"`, which skips disabled items
   - a **Collapse all** button

   Put a Toolbar inside each inner FAQ accordion. It has to count and control only its own accordion.

> Think: the root accordion doesn't receive the list of item values as a prop. How does it find out?

---

## Stretch (if you finish early)

- Animate content height open and closed.
- Export a `useAccordionItem()` hook so a consumer can build a custom trigger, for example one that shows "Open" or "Closed" text.
- Memoize the context value, then check with React DevTools Profiler that toggling one item doesn't re-render unrelated sections' accordions.
