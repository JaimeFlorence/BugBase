import { useParams } from 'react-router-dom';

export default function ProjectDetail() {
  const { projectId } = useParams();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Project Detail</h1>
      <p className="text-muted-foreground">Project ID: {projectId}</p>
    </div>
  );
}