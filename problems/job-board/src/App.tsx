export type Job = {
  id: number;
  type: "job";
  by: string;
  title: string;
  time: number; // unix SECONDS
  url?: string;
};

export default function App() {
  return (
    <main className="app">
      <h1>Job Board</h1>
      {/* your code here */}
    </main>
  );
}
