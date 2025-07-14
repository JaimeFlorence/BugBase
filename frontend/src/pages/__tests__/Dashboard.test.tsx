import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Dashboard from '../Dashboard';

// Mock the dependencies
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: '1',
      fullName: 'Test User',
      email: 'test@example.com',
      username: 'testuser'
    }
  }))
}));

vi.mock('@/services/bug.service', () => ({
  default: {
    getBugStatistics: vi.fn()
  }
}));

vi.mock('@/components/BugList', () => ({
  BugList: ({ filters }: any) => (
    <div data-testid="bug-list">
      BugList Component - Status: {filters?.status}
    </div>
  )
}));

import bugService from '@/services/bug.service';

// Create a wrapper with all providers
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('should render the dashboard title and welcome message', () => {
      const mockStats = {
        total: 10,
        open: 5,
        inProgress: 2,
        resolved: 3
      };
      vi.mocked(bugService.getBugStatistics).mockResolvedValue(mockStats);

      render(<Dashboard />, { wrapper: createWrapper() });

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Welcome back, Test User!')).toBeInTheDocument();
    });

    it('should render without user fullName', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          fullName: undefined
        },
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn()
      } as any);

      const mockStats = {
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0
      };
      vi.mocked(bugService.getBugStatistics).mockResolvedValue(mockStats);

      render(<Dashboard />, { wrapper: createWrapper() });

      expect(screen.getByText('Welcome back, !')).toBeInTheDocument();
    });
  });

  describe('Statistics cards', () => {
    it('should render all statistics cards with data', async () => {
      const mockStats = {
        total: 25,
        open: 10,
        inProgress: 8,
        resolved: 7
      };
      vi.mocked(bugService.getBugStatistics).mockResolvedValue(mockStats);

      render(<Dashboard />, { wrapper: createWrapper() });

      // Check all stat cards are rendered
      expect(await screen.findByText('Total Bugs')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();

      expect(screen.getByText('Open Bugs')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();

      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();

      expect(screen.getByText('Resolved')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('should render statistics cards with zero values when no data', () => {
      vi.mocked(bugService.getBugStatistics).mockResolvedValue(null as any);

      render(<Dashboard />, { wrapper: createWrapper() });

      // Should show 0 for all stats when data is null
      const zeroValues = screen.getAllByText('0');
      expect(zeroValues).toHaveLength(4);
    });

    it('should render statistics cards with partial data', async () => {
      const mockStats = {
        total: 15,
        open: 5,
        // inProgress and resolved are undefined
      };
      vi.mocked(bugService.getBugStatistics).mockResolvedValue(mockStats as any);

      render(<Dashboard />, { wrapper: createWrapper() });

      expect(await screen.findByText('15')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      
      // Should show 0 for undefined values
      const zeroValues = screen.getAllByText('0');
      expect(zeroValues).toHaveLength(2);
    });

    it('should render correct icons for each stat card', () => {
      const mockStats = {
        total: 10,
        open: 5,
        inProgress: 2,
        resolved: 3
      };
      vi.mocked(bugService.getBugStatistics).mockResolvedValue(mockStats);

      const { container } = render(<Dashboard />, { wrapper: createWrapper() });

      // Check that we have 4 icon containers
      const iconContainers = container.querySelectorAll('.rounded-full');
      expect(iconContainers).toHaveLength(4);

      // Check color classes for each icon container
      expect(iconContainers[0]).toHaveClass('bg-blue-100');
      expect(iconContainers[1]).toHaveClass('bg-orange-100');
      expect(iconContainers[2]).toHaveClass('bg-yellow-100');
      expect(iconContainers[3]).toHaveClass('bg-green-100');
    });
  });

  describe('Recent bugs section', () => {
    it('should render recent bugs section with correct heading', () => {
      vi.mocked(bugService.getBugStatistics).mockResolvedValue({
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0
      });

      render(<Dashboard />, { wrapper: createWrapper() });

      expect(screen.getByText('Recent Bugs')).toBeInTheDocument();
    });

    it('should render "View all bugs" link', () => {
      vi.mocked(bugService.getBugStatistics).mockResolvedValue({
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0
      });

      render(<Dashboard />, { wrapper: createWrapper() });

      const viewAllLink = screen.getByText('View all bugs →');
      expect(viewAllLink).toBeInTheDocument();
      expect(viewAllLink).toHaveAttribute('href', '/bugs');
    });

    it('should render BugList component with NEW status filter', () => {
      vi.mocked(bugService.getBugStatistics).mockResolvedValue({
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0
      });

      render(<Dashboard />, { wrapper: createWrapper() });

      const bugList = screen.getByTestId('bug-list');
      expect(bugList).toBeInTheDocument();
      expect(bugList).toHaveTextContent('Status: NEW');
    });
  });

  describe('Loading and error states', () => {
    it('should handle loading state for statistics', () => {
      vi.mocked(bugService.getBugStatistics).mockImplementation(() => 
        new Promise(() => {}) // Never resolves to simulate loading
      );

      render(<Dashboard />, { wrapper: createWrapper() });

      // Should still render the page structure
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      
      // Should show 0 values while loading
      const zeroValues = screen.getAllByText('0');
      expect(zeroValues).toHaveLength(4);
    });

    it('should handle error state for statistics', async () => {
      vi.mocked(bugService.getBugStatistics).mockRejectedValue(
        new Error('Failed to fetch statistics')
      );

      render(<Dashboard />, { wrapper: createWrapper() });

      // Should still render the page structure
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      
      // Should show 0 values on error
      const zeroValues = screen.getAllByText('0');
      expect(zeroValues).toHaveLength(4);
    });
  });

  describe('Responsive layout', () => {
    it('should apply responsive grid classes to statistics cards', () => {
      vi.mocked(bugService.getBugStatistics).mockResolvedValue({
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0
      });

      const { container } = render(<Dashboard />, { wrapper: createWrapper() });

      const statsGrid = container.querySelector('.grid');
      expect(statsGrid).toHaveClass('md:grid-cols-2', 'lg:grid-cols-4');
    });

    it('should apply correct spacing classes', () => {
      vi.mocked(bugService.getBugStatistics).mockResolvedValue({
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0
      });

      const { container } = render(<Dashboard />, { wrapper: createWrapper() });

      const statsGrid = container.querySelector('.grid');
      expect(statsGrid).toHaveClass('gap-6', 'mb-8');
    });
  });
});