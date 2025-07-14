import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BugList } from '@/components/BugList';

export default function Bugs() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Bugs</h1>
          <p className="text-muted-foreground mt-2">
            Track and manage all bugs across your projects
          </p>
        </div>
        
        <Button asChild>
          <Link to="/bugs/new">
            <Plus className="h-4 w-4 mr-2" />
            New Bug
          </Link>
        </Button>
      </div>

      <BugList />
    </div>
  );
}