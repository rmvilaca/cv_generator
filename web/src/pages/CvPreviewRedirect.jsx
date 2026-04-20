import { useParams, Navigate } from "react-router-dom";

export default function CvPreviewRedirect() {
  const { postingId } = useParams();
  return <Navigate to={`/job-postings/${postingId}?tab=cv`} replace />;
}
