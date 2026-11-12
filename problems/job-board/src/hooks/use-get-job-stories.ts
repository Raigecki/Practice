import { useEffect, useState } from "react";

export default function useGetJobStories() {
  const [data, setData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/jobstories", {
          signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP: error! Status: ${response.status}`);
        }

        const responseData: number[] = await response.json();
        setData(responseData);
      } catch (err) {
        if (!signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    fetchData();
    return () => controller.abort();
  }, []);

  return {
    data,
    isLoading,
    error,
  };
}
