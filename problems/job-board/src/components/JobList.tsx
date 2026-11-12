import { useMemo, useState } from "react";
import useGetJobsById from "../hooks/use-get-jobs";

type Props = {
  jobIds: number[];
};

export default function JobList({ jobIds }: Props) {
  const [cursorIndex, setCursorIndex] = useState(0);

  const currentBatch = useMemo(
    () => jobIds.slice(cursorIndex, cursorIndex + 6),
    [cursorIndex, jobIds],
  );
  const { data, isLoading, error } = useGetJobsById({ ids: currentBatch });
  if (isLoading && cursorIndex < 6) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
      }}
    >
      {data.map((job) => (
        <div
          key={job.id}
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            borderBottom: "solid 1px #828282",
            padding: "0px 4px 4px 4px",
          }}
        >
          {job.url ? (
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              <h3>{job.title}</h3>
            </a>
          ) : (
            <h3>{job.title}</h3>
          )}
          <div style={{ display: "flex", flexDirection: "row", gap: "4px" }}>
            <span>{`By ${job.by}`}</span>
            {" · "}
            <span>{new Date(job.time * 1000).toLocaleString()}</span>
          </div>
        </div>
      ))}
      {error ? <div>{error.message}</div> : null}
      {isLoading && cursorIndex >= 6 ? (
        <div style={{ display: "flex", width: "100%" }}>Loading...</div>
      ) : null}
      {jobIds.length - cursorIndex > 6 ? (
        <button
          disabled={isLoading}
          onClick={() => setCursorIndex((prev) => prev + 6)}
        >
          Load more
        </button>
      ) : null}
    </div>
  );
}
