import { useParams } from 'react-router-dom';

export default function BugDetail() {
  const { projectId, bugId } = useParams();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Bug Detail</h1>
      <p className="text-muted-foreground">Project ID: {projectId}</p>
      <p className="text-muted-foreground">Bug ID: {bugId}</p>
    </div>
  );
}