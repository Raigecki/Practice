import useGetJobsById from "../hooks/use-get-jobs";

type Props = {
  jobIds: number[];
};

export default function JobList({ jobIds }: Props) {


  const { data, isLoading, error, cursorIndex, loadMore, retry } = useGetJobsById({ ids: jobIds });
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
      {error ? <div style={{
        width: "100%",
        display: "flex", 
        flexDirection: "row", 
        justifyContent:"space-between"
      }}>
        {error.message}
        <button onClick={() => {
          retry()
        }}>Retry</button>
      </div> : null}
      {isLoading && cursorIndex >= 6 ? (
        <div style={{ display: "flex", width: "100%" }}>Loading...</div>
      ) : null}
      {jobIds.length - cursorIndex > 6 ? (
        <button
          disabled={isLoading}
          onClick={() => {
            loadMore()
          }}
        >
          Load more
        </button>
      ) : null}
    </div>
  );
}
