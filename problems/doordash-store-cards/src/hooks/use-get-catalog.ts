import { useEffect, useState } from "react";

export interface Item {
  id: string;
  name: string;
  cuisine: string[];
  priceRange: string;
  rating: number | null;
  reviewCount: number;
  distanceMiles: number;
  deliveryTimeMinutes: { min: number; max: number };
  deliveryFeeCents: number;
  isOpen: boolean;
  isDashPass: boolean;
  promo: string | null;
  imageUrl: string | null;
}

export default function useGetCatalog() {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/stores", { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setItems(data.stores);
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
    return () => controller.abort();
  }, []);

  return { items, isLoading, error };
}
