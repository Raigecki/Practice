// Mock dish search API.
//
//   GET /api/search?q=piz   -> { query: string, results: Dish[] }   (max 10, case-insensitive substring match)
//
// SHORTER queries are SLOWER (~900ms for 1 char, ~150ms for 4+ chars), plus jitter.
// Type quickly and the response for "p" can arrive AFTER the response for "piz".
// That's deliberate: see Part 2.
//
// Every request is logged with a running count, so you can watch debouncing/caching work.

import { createServer } from "node:http";

const PORT = 3005;

const names = [
  "Margherita Pizza", "Pepperoni Pizza", "Hawaiian Pizza", "Pizza Bianca", "Pita Wrap",
  "Pineapple Fried Rice", "Pad Thai", "Pad See Ew", "Panang Curry", "Pho Tai",
  "Pork Belly Bao", "Potstickers", "Poke Bowl", "Pierogi", "Paella",
  "Pasta Carbonara", "Pasta Alfredo", "Penne Arrabbiata", "Pesto Gnocchi", "Philly Cheesesteak",
  "Chicken Tikka Masala", "Chicken Parmesan", "Chicken Shawarma", "Chicken Katsu", "Chicken Teriyaki",
  "Chicken Caesar Salad", "Chicken Quesadilla", "Chicken Pot Pie", "Chili Cheese Fries", "Chilaquiles",
  "Beef Bulgogi", "Beef Brisket", "Beef Pho", "Beef Wellington", "Bibimbap",
  "Burrito Bowl", "Butter Chicken", "Banh Mi", "Bagel & Lox", "BLT Sandwich",
  "Ramen Tonkotsu", "Ramen Shoyu", "Spicy Miso Ramen", "Ratatouille", "Risotto ai Funghi",
  "Salmon Nigiri", "Spicy Tuna Roll", "California Roll", "Dragon Roll", "Rainbow Roll",
  "Tacos al Pastor", "Fish Tacos", "Carne Asada Tacos", "Tamales", "Tom Yum Soup",
  "Tom Kha Gai", "Tonkatsu", "Tempura Udon", "Tikka Paneer", "Tiramisu",
  "Green Curry", "Greek Salad", "Gyro Platter", "Garlic Naan", "General Tso's Chicken",
  "Kung Pao Chicken", "Korean Fried Chicken", "Kimchi Fried Rice", "Katsu Curry", "Khao Soi",
  "Mapo Tofu", "Massaman Curry", "Mac & Cheese", "Meatball Sub", "Mushroom Swiss Burger",
  "Cheeseburger", "Double Smash Burger", "Veggie Burger", "Falafel Wrap", "French Onion Soup",
  "Egg Fried Rice", "Eggplant Parmesan", "Enchiladas Verdes", "Elote", "Empanadas",
  "Dan Dan Noodles", "Dumplings", "Dal Makhani", "Duck Confit", "Donburi",
  "Lasagna", "Lamb Vindaloo", "Lobster Roll", "Lo Mein", "Laksa",
  "Nachos Supreme", "Nasi Goreng", "Niçoise Salad", "Orange Chicken", "Onion Rings",
  "Samosas", "Saag Paneer", "Shrimp Scampi", "Sesame Chicken", "Spring Rolls",
  "Udon Noodle Soup", "Vegetable Biryani", "Chicken Biryani", "Waffles & Chicken", "Wonton Soup",
];

const dishes = names.map((name, i) => ({
  id: `d_${String(i + 1).padStart(3, "0")}`,
  name,
  priceCents: 899 + ((i * 173) % 1400),
}));

let requestCount = 0;

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const q = (url.searchParams.get("q") ?? "").trim();
  const delay = Math.max(150, 900 - (q.length - 1) * 250) + Math.random() * 150;

  requestCount++;
  console.log(`#${requestCount} ${url.pathname}?q=${JSON.stringify(q)}  (${Math.round(delay)}ms)`);

  setTimeout(() => {
    if (req.method !== "GET" || url.pathname !== "/api/search") {
      return send(res, 404, { error: "Not found" });
    }
    if (q.toLowerCase() === "error") return send(res, 500, { error: "Search is down" }); // for testing error UI

    const needle = q.toLowerCase();
    const results = needle ? dishes.filter((d) => d.name.toLowerCase().includes(needle)).slice(0, 10) : [];
    send(res, 200, { query: q, results });
  }, delay);
}).listen(PORT, () => console.log(`mock search api on http://localhost:${PORT}`));
