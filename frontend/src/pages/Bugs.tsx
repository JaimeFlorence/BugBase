import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Filter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BugList } from '@/components/BugList';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import type { BugFilters, BugStatus, BugPriority, BugSeverity } from '@/types';

export default function Bugs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  
  // Parse filters from URL
  const filters: BugFilters = {
    projectId: searchParams.get('projectId') || undefined,
    status: searchParams.get('status') as BugStatus | undefined,
    priority: searchParams.get('priority') as BugPriority | undefined,
    severity: searchParams.get('severity') as BugSeverity | undefined,
    assigneeId: searchParams.get('assigneeId') || undefined,
    reporterId: searchParams.get('reporterId') || undefined,
    search: searchParams.get('search') || undefined,
  };

  // Advanced filter states
  const [advancedFilters, setAdvancedFilters] = useState({
    dateRange: searchParams.get('dateRange') || 'all',
    hasAttachments: searchParams.get('hasAttachments') === 'true',
    hasComments: searchParams.get('hasComments') === 'true',
    isWatching: searchParams.get('isWatching') === 'true',
  });

  const updateFilters = (key: string, value: any) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const clearAllFilters = () => {
    setSearchParams({});
    setAdvancedFilters({
      dateRange: 'all',
      hasAttachments: false,
      hasComments: false,
      isWatching: false,
    });
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length + 
    Object.entries(advancedFilters).filter(([key, value]) => 
      key === 'dateRange' ? value !== 'all' : value
    ).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Bugs</h1>
          <p className="text-muted-foreground mt-2">
            Track and manage all bugs across your projects
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Sheet open={showFilters} onOpenChange={setShowFilters}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px]">
              <SheetHeader>
                <SheetTitle>Advanced Filters</SheetTitle>
                <SheetDescription>
                  Refine your bug search with advanced filters
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {/* Date Range */}
                <div>
                  <Label>Date Range</Label>
                  <RadioGroup
                    value={advancedFilters.dateRange}
                    onValueChange={(value) => {
                      setAdvancedFilters({ ...advancedFilters, dateRange: value });
                      updateFilters('dateRange', value === 'all' ? null : value);
                    }}
                    className="mt-2 space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="all" />
                      <Label htmlFor="all" className="font-normal">All time</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="today" id="today" />
                      <Label htmlFor="today" className="font-normal">Today</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="week" id="week" />
                      <Label htmlFor="week" className="font-normal">This week</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="month" id="month" />
                      <Label htmlFor="month" className="font-normal">This month</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="quarter" id="quarter" />
                      <Label htmlFor="quarter" className="font-normal">This quarter</Label>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                {/* Additional Filters */}
                <div className="space-y-3">
                  <Label>Additional Filters</Label>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasAttachments"
                      checked={advancedFilters.hasAttachments}
                      onCheckedChange={(checked) => {
                        setAdvancedFilters({ ...advancedFilters, hasAttachments: !!checked });
                        updateFilters('hasAttachments', checked ? 'true' : null);
                      }}
                    />
                    <Label htmlFor="hasAttachments" className="font-normal">
                      Has attachments
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasComments"
                      checked={advancedFilters.hasComments}
                      onCheckedChange={(checked) => {
                        setAdvancedFilters({ ...advancedFilters, hasComments: !!checked });
                        updateFilters('hasComments', checked ? 'true' : null);
                      }}
                    />
                    <Label htmlFor="hasComments" className="font-normal">
                      Has comments
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isWatching"
                      checked={advancedFilters.isWatching}
                      onCheckedChange={(checked) => {
                        setAdvancedFilters({ ...advancedFilters, isWatching: !!checked });
                        updateFilters('isWatching', checked ? 'true' : null);
                      }}
                    />
                    <Label htmlFor="isWatching" className="font-normal">
                      Bugs I'm watching
                    </Label>
                  </div>
                </div>

                <Separator />

                {/* Clear Filters */}
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllFilters}
                    disabled={activeFilterCount === 0}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear all
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowFilters(false)}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Button asChild>
            <Link to="/bugs/new">
              <Plus className="h-4 w-4 mr-2" />
              New Bug
            </Link>
          </Button>
        </div>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">Active filters:</span>
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              <Search className="h-3 w-3" />
              {filters.search}
              <button
                onClick={() => updateFilters('search', null)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.status.replace('_', ' ')}
              <button
                onClick={() => updateFilters('status', null)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.priority && (
            <Badge variant="secondary" className="gap-1">
              Priority: {filters.priority}
              <button
                onClick={() => updateFilters('priority', null)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.severity && (
            <Badge variant="secondary" className="gap-1">
              Severity: {filters.severity}
              <button
                onClick={() => updateFilters('severity', null)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {advancedFilters.dateRange !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Date: {advancedFilters.dateRange}
              <button
                onClick={() => {
                  setAdvancedFilters({ ...advancedFilters, dateRange: 'all' });
                  updateFilters('dateRange', null);
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {advancedFilters.hasAttachments && (
            <Badge variant="secondary" className="gap-1">
              Has attachments
              <button
                onClick={() => {
                  setAdvancedFilters({ ...advancedFilters, hasAttachments: false });
                  updateFilters('hasAttachments', null);
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {advancedFilters.hasComments && (
            <Badge variant="secondary" className="gap-1">
              Has comments
              <button
                onClick={() => {
                  setAdvancedFilters({ ...advancedFilters, hasComments: false });
                  updateFilters('hasComments', null);
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {advancedFilters.isWatching && (
            <Badge variant="secondary" className="gap-1">
              Watching
              <button
                onClick={() => {
                  setAdvancedFilters({ ...advancedFilters, isWatching: false });
                  updateFilters('isWatching', null);
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
          >
            Clear all
          </Button>
        </div>
      )}

      <BugList filters={filters} />
    </div>
  );
}