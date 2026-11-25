import { useState } from "react";
import useGetJobStories from "../hooks/use-get-job-stories";
import JobList from "./JobList";

export default function JobBoard() {
  const { data, isLoading, error, retry } = useGetJobStories();
  const [pageSize, setPageSize] = useState<number>(6);

  if (isLoading) {
    return <span>Loading...</span>;
  } else if (error) {
    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <span>{`Error getting jobs ${error.message}`}</span>
        <button onClick={() => retry()}>Retry</button>
      </div>
    );
  }
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
          justifyContent: "end",
          gap: "4px",
        }}
      >
        {"Page size: "}
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
        >
          <option value={6}>6</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
        </select>
      </div>
      <JobList key={pageSize} jobIds={data} pageSize={pageSize} />
    </div>
  );
}
