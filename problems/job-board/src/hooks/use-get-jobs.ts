import { Dispatch, useEffect, useState } from "react";
import { Job } from "../App";

type Props = {
  ids: number[];
};

async function fetchJob(id: number, signal: AbortSignal) {
  const response = await fetch(`/api/item/${id}?failRate=0.3`, { signal });
  if (!response.ok) {
    throw new Error(
      `Error fetching job for id: ${id}, Status: ${response.status}`,
    );
  }
  return response.json();
}

const getJobs = async (
  ids: number[], 
  setIsLoading: Dispatch<React.SetStateAction<boolean>>,
  setError: Dispatch<React.SetStateAction<Error | null>>,
  setData: Dispatch<React.SetStateAction<Job[]>>,
  setFailedIds: Dispatch<React.SetStateAction<number[]>>,
  controller: AbortController,
) => {
  const signal = controller.signal

  try {
    setIsLoading(true)
    setError(null)

    const results = await Promise.allSettled(ids.map(id => 
      fetchJob(id, signal)))

    const jobs: Job[] = [];
    const failed: number[] = []
    results.forEach((res, index) => {
      res.status === "fulfilled" ? 
        jobs.push(res.value) : failed.push(ids[index])
    })


    if (!signal.aborted) {
      setData(prev => [... prev, ...jobs])
      setFailedIds(failed)

      if (failed.length > 0) {
        throw new Error(`Failed to get jobs of ids: ${failed.toString()}`)
      }
    }


  } catch (err) {
    if (!signal.aborted) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  } finally {
    if (!signal.aborted) {
      setIsLoading(false)
    }
  }
}



export default function useGetJobsById({ ids }: Props) {
  const [data, setData] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [failedIds, setFailedIds] = useState<number[]>([]);

  const [idWindow, setIdWindow] = useState<number[]>([])


  useEffect(() => {
    const controller = new AbortController()
    if (cursorIndex == 0) {
      loadMore()
    }
    getJobs(idWindow, setIsLoading, setError, setData, setFailedIds, controller);
    return () => controller.abort();
  }, [idWindow]);

  function retry() {
    setIdWindow([...failedIds])
  }

  function loadMore() {
    setIdWindow(ids.slice(cursorIndex, cursorIndex + 6))
    setCursorIndex(prev => prev + 6)
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
