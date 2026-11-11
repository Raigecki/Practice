import Catalog from "./components/Catalog";

// Data: GET /api/stores  (proxied to mock/server.mjs)
//   ?delay=2000  simulate a slow response (ms)
//   ?fail=1      simulate a 500 error

export default function App() {
  return (
    <main className="app">
      <Catalog />
    </main>
  );
}
