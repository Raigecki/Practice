import { useEffect, useRef, useState } from "react";
import { Job } from "../App";

type Props = {
  ids: number[];
  pageSize: number;
};

async function fetchJob(id: number, signal: AbortSignal): Promise<Job> {
  const response = await fetch(`/api/item/${id}?failRate=0.3`, { signal });
  if (!response.ok) {
    throw new Error(
      `Error fetching job for id: ${id}, Status: ${response.status}`,
    );
  }
  return response.json();
}

export default function useGetJobsById({ ids, pageSize }: Props) {
  const [data, setData] = useState<Record<number, Job>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [failedIds, setFailedIds] = useState<number[]>([]);

  const controllerRef = useRef<AbortController | null>(null);

  const getJobs = async (idWindow: number[]) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const signal = controllerRef.current?.signal;
    try {
      setIsLoading(true);
      setError(null);

      const results = await Promise.allSettled(
        idWindow.map((id) => fetchJob(id, signal)),
      );

      const jobs: Record<number, Job> = {};
      const failed: number[] = [];
      results.forEach((res, index) => {
        res.status === "fulfilled"
          ? (jobs[res.value.id] = res.value)
          : failed.push(idWindow[index]);
      });

      if (!signal.aborted) {
        setData((prev) => ({ ...prev, ...jobs }));
        setFailedIds(failed);

        if (failed.length > 0) {
          throw new Error(`Failed to get jobs of ids: ${failed.toString()}`);
        }
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

  useEffect(() => {
    getJobs(ids.slice(0, pageSize));
    setCursorIndex(pageSize);
    return () => controllerRef.current?.abort();
  }, [ids]);

  function retry() {
    getJobs([...failedIds]);
    setFailedIds([]);
  }

  function loadMore() {
    getJobs(ids.slice(cursorIndex, cursorIndex + pageSize));
    setCursorIndex((prev) => prev + pageSize);
  }

  return {
    data,
    isLoading,
    error,
    cursorIndex,
    loadMore,
    retry,
  };
}
