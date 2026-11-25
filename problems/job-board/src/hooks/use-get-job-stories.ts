import { useEffect, useRef, useState } from "react";

export default function useGetJobStories() {
  const [data, setData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const controllerRef = useRef<AbortController | null>(null);

  const fetchData = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const signal = controllerRef.current.signal;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/jobstories?failRate=0.5", {
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

  const retry = () => {
    fetchData();
  };

  useEffect(() => {
    fetchData();
    return () => controllerRef.current?.abort();
  }, []);

  return {
    data,
    isLoading,
    error,
    retry,
  };
}
