import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BugList } from '@/components/BugList';
import { Bug, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import bugService from '@/services/bug.service';
import { BugStatus } from '@/types';

export default function Dashboard() {
  const { user } = useAuth();

  const { data: statistics } = useQuery({
    queryKey: ['bug-statistics'],
    queryFn: () => bugService.getBugStatistics(),
  });

  const stats = [
    {
      title: 'Total Bugs',
      value: statistics?.total || 0,
      icon: Bug,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      title: 'Open Bugs',
      value: statistics?.open || 0,
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    },
    {
      title: 'In Progress',
      value: statistics?.inProgress || 0,
      icon: TrendingUp,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
    {
      title: 'Resolved',
      value: statistics?.resolved || 0,
      icon: TrendingDown,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Welcome back, {user?.fullName}!</p>
      </div>
      
      {/* Statistics Cards */}
      <div className="grid gap-6 mb-8 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Bugs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Bugs</h2>
          <Link 
            to="/bugs" 
            className="text-sm text-primary hover:underline"
          >
            View all bugs →
          </Link>
        </div>
        
        <BugList 
          filters={{ 
            status: BugStatus.NEW 
          }} 
        />
      </div>
    </div>
  );
}