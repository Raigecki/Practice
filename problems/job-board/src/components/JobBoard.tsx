import useGetJobStories from "../hooks/use-get-job-stories";
import JobList from "./JobList";

export default function JobBoard() {
  const { data, isLoading, error } = useGetJobStories();

  if (isLoading) {
    return <span>Loading...</span>;
  } else if (error) {
    return <span>{`Error getting jobs ${error.message}`}</span>;
  }
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <JobList jobIds={data} />
    </div>
  );
}
