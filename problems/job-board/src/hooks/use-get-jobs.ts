import { useEffect, useState } from "react";
import { Job } from "../App";

type Props = {
  ids: number[];
};

async function fetchJob(id: number, signal: AbortSignal) {
  const response = await fetch(`/api/item/${id}`, { signal });
  if (!response.ok) {
    throw new Error(
      `Error fetching job for id: ${id}, Status: ${response.status}`,
    );
  }
  return response.json();
}

export default function useGetJobsById({ ids }: Props) {
  const [data, setData] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const getJobs = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const jobs: Job[] = await Promise.all(
          ids.map((id) => fetchJob(id, signal)),
        );
        if (!signal.aborted) {
          setData((prev) => [...prev, ...jobs]);
        }
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
    getJobs();
    return () => controller.abort();
  }, [ids]);

  return {
    data,
    isLoading,
    error,
  };
}
