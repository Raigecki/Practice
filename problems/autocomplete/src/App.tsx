export type Dish = {
  id: string;
  name: string;
  priceCents: number;
};

export type SearchResponse = {
  query: string;
  results: Dish[];
};

export default function App() {
  return (
    <main className="app">
      <h1>Dish Search</h1>
      {/* your code here */}
    </main>
  );
}
