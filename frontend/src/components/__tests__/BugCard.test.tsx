import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { BugCard } from '../BugCard';
import { Bug, BugStatus, BugPriority, BugSeverity } from '../../types';

// Wrapper component for React Router
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('BugCard', () => {
  const mockBug: Bug = {
    id: '1',
    bugNumber: 123,
    title: 'Test Bug Title',
    description: 'This is a test bug description that might be quite long and should be truncated properly.',
    status: BugStatus.NEW,
    priority: BugPriority.HIGH,
    severity: BugSeverity.MAJOR,
    reporterId: 'user-1',
    projectId: 'project-1',
    createdAt: new Date('2023-01-01T10:00:00Z'),
    updatedAt: new Date('2023-01-02T10:00:00Z'),
    reporter: {
      id: 'user-1',
      username: 'reporter',
      fullName: 'Bug Reporter',
      email: 'reporter@example.com'
    },
    assignee: {
      id: 'user-2',
      username: 'assignee',
      fullName: 'Bug Assignee',
      email: 'assignee@example.com'
    },
    project: {
      id: 'project-1',
      key: 'TEST',
      name: 'Test Project'
    },
    _count: {
      comments: 3,
      attachments: 2,
      watchers: 5
    }
  };

  const renderBugCard = (bug: Partial<Bug> = {}, props: Partial<React.ComponentProps<typeof BugCard>> = {}) => {
    return render(
      <RouterWrapper>
        <BugCard bug={{ ...mockBug, ...bug }} {...props} />
      </RouterWrapper>
    );
  };

  describe('Basic rendering', () => {
    it('should render bug title and description', () => {
      renderBugCard();
      
      expect(screen.getByText('Test Bug Title')).toBeInTheDocument();
      expect(screen.getByText(/This is a test bug description/)).toBeInTheDocument();
    });

    it('should render bug reference with project key', () => {
      renderBugCard();
      
      expect(screen.getByText('TEST-123')).toBeInTheDocument();
    });

    it('should render bug reference with custom project key', () => {
      renderBugCard({}, { projectKey: 'CUSTOM' });
      
      expect(screen.getByText('CUSTOM-123')).toBeInTheDocument();
    });

    it('should render bug reference with fallback when no project key', () => {
      renderBugCard({ project: undefined });
      
      expect(screen.getByText('BUG-123')).toBeInTheDocument();
    });

    it('should render created date in relative format', () => {
      renderBugCard();
      
      // The exact text will depend on current date, but should contain "ago"
      expect(screen.getByText(/ago$/)).toBeInTheDocument();
    });

    it('should be a link to bug detail page', () => {
      renderBugCard();
      
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/bugs/1');
    });
  });

  describe('Badge rendering', () => {
    it('should render status badge', () => {
      renderBugCard();
      
      expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('should render priority badge', () => {
      renderBugCard();
      
      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('should render severity badge', () => {
      renderBugCard();
      
      expect(screen.getByText('Major')).toBeInTheDocument();
    });

    it('should render labels when present', () => {
      const bugWithLabels = {
        labels: [
          {
            labelId: 'label-1',
            bugId: '1',
            label: {
              id: 'label-1',
              name: 'Frontend',
              color: '#3B82F6'
            }
          },
          {
            labelId: 'label-2', 
            bugId: '1',
            label: {
              id: 'label-2',
              name: 'Critical',
              color: '#EF4444'
            }
          }
        ]
      };

      renderBugCard(bugWithLabels);
      
      expect(screen.getByText('Frontend')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });
  });

  describe('User information', () => {
    it('should render reporter information', () => {
      renderBugCard();
      
      expect(screen.getByText('Bug Reporter')).toBeInTheDocument();
    });

    it('should render reporter username as fallback', () => {
      renderBugCard({
        reporter: {
          id: 'user-1',
          username: 'reporter',
          fullName: '',
          email: 'reporter@example.com'
        }
      });
      
      expect(screen.getByText('reporter')).toBeInTheDocument();
    });

    it('should render assignee when present', () => {
      renderBugCard();
      
      expect(screen.getByText('Bug Assignee')).toBeInTheDocument();
    });

    it('should not render assignee when not assigned', () => {
      renderBugCard({ assignee: undefined });
      
      expect(screen.queryByText('Bug Assignee')).not.toBeInTheDocument();
    });

    it('should render assignee username as fallback', () => {
      renderBugCard({
        assignee: {
          id: 'user-2',
          username: 'assignee',
          fullName: '',
          email: 'assignee@example.com'
        }
      });
      
      expect(screen.getByText('assignee')).toBeInTheDocument();
    });
  });

  describe('Due date', () => {
    it('should render due date when present', () => {
      renderBugCard({
        dueDate: new Date('2023-12-31T23:59:59Z')
      });
      
      expect(screen.getByText('12/31/2023')).toBeInTheDocument();
    });

    it('should not render due date when not set', () => {
      renderBugCard({ dueDate: undefined });
      
      // Should not have Clock icon when no due date
      expect(screen.queryByText(/\/.*\//)).not.toBeInTheDocument();
    });
  });

  describe('Counts', () => {
    it('should render comment count when present', () => {
      renderBugCard();
      
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render attachment count when present', () => {
      renderBugCard();
      
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should render watcher count when present', () => {
      renderBugCard();
      
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should not render counts when zero or undefined', () => {
      renderBugCard({
        _count: {
          comments: 0,
          attachments: 0,
          watchers: 0
        }
      });
      
      // Should not render any count elements when counts are 0
      const messageSquareIcon = screen.queryByTestId('message-square-icon');
      const paperclipIcon = screen.queryByTestId('paperclip-icon');
      const eyeIcon = screen.queryByTestId('eye-icon');
      
      expect(messageSquareIcon).not.toBeInTheDocument();
      expect(paperclipIcon).not.toBeInTheDocument();
      expect(eyeIcon).not.toBeInTheDocument();
    });

    it('should handle missing _count object', () => {
      renderBugCard({ _count: undefined });
      
      // Should not crash and should not render any counts
      expect(screen.getByText('Test Bug Title')).toBeInTheDocument();
    });
  });

  describe('Styling and layout', () => {
    it('should apply custom className', () => {
      const { container } = renderBugCard({}, { className: 'custom-class' });
      
      const link = container.querySelector('a');
      expect(link).toHaveClass('custom-class');
    });

    it('should have default card styling', () => {
      const { container } = renderBugCard();
      
      const link = container.querySelector('a');
      expect(link).toHaveClass(
        'block',
        'p-4',
        'bg-white',
        'dark:bg-gray-800',
        'rounded-lg',
        'border',
        'hover:shadow-md'
      );
    });

    it('should have proper hover styling', () => {
      const { container } = renderBugCard();
      
      const link = container.querySelector('a');
      expect(link).toHaveClass('hover:shadow-md', 'transition-shadow');
    });
  });

  describe('Edge cases', () => {
    it('should handle missing reporter gracefully', () => {
      renderBugCard({ reporter: undefined });
      
      expect(screen.getByText('Test Bug Title')).toBeInTheDocument();
    });

    it('should handle missing project gracefully', () => {
      renderBugCard({ project: undefined });
      
      expect(screen.getByText('BUG-123')).toBeInTheDocument();
    });

    it('should handle very long title', () => {
      const longTitle = 'A'.repeat(200);
      renderBugCard({ title: longTitle });
      
      const titleElement = screen.getByText(longTitle);
      expect(titleElement).toHaveClass('truncate');
    });

    it('should handle very long description', () => {
      const longDescription = 'Very long description. '.repeat(50);
      renderBugCard({ description: longDescription });
      
      // Use partial match since line-clamp-2 may truncate the text
      const descriptionElement = screen.getByText(/Very long description\./);
      expect(descriptionElement).toHaveClass('line-clamp-2');
    });
  });
});