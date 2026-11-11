# Store Cards

Fetch a list of stores and render them as cards with appropriate styling.

## Run

```sh
npm install
npm run dev     # mock API on :3003 + Vite on :5173 (proxies /api)
```

## API

`GET /api/stores` returns `{ stores: Store[] }`
`GET /api/stores/:id` returns `Store` (404 if missing)

Query params (any endpoint):

| Param | Effect |
| --- | --- |
| `delay=<ms>` | Response delay, default 500 |
| `fail=1` | Returns 500 |

## Store shape

```js
{
  id: "st_001",
  name: "Golden Dragon Noodle House",
  cuisine: ["Chinese", "Noodles"],
  priceRange: "$$",
  rating: 4.7,               // null when no reviews yet
  reviewCount: 2310,
  distanceMiles: 0.8,
  deliveryTimeMinutes: { min: 20, max: 30 },
  deliveryFeeCents: 199,     // 0 = free delivery
  isOpen: true,
  isDashPass: true,
  promo: "20% off orders $25+",  // or null
  imageUrl: "https://..."        // or null
}
```

Edge cases in the data: closed stores, `null` rating, `null` image, `$0` delivery fee, a very long name.
