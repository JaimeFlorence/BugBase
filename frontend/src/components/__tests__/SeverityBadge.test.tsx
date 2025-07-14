import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SeverityBadge } from '../SeverityBadge';
import { BugSeverity } from '../../types';

describe('SeverityBadge', () => {
  describe('Basic rendering', () => {
    it('should render BLOCKER severity correctly', () => {
      render(<SeverityBadge severity={BugSeverity.BLOCKER} />);
      
      const badge = screen.getByText('Blocker');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-red-100', 'text-red-800');
    });

    it('should render MAJOR severity correctly', () => {
      render(<SeverityBadge severity={BugSeverity.MAJOR} />);
      
      const badge = screen.getByText('Major');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-orange-100', 'text-orange-800');
    });

    it('should render MINOR severity correctly', () => {
      render(<SeverityBadge severity={BugSeverity.MINOR} />);
      
      const badge = screen.getByText('Minor');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });

    it('should render TRIVIAL severity correctly', () => {
      render(<SeverityBadge severity={BugSeverity.TRIVIAL} />);
      
      const badge = screen.getByText('Trivial');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
    });
  });

  describe('Icon rendering', () => {
    it('should not show icon by default', () => {
      render(<SeverityBadge severity={BugSeverity.BLOCKER} />);
      
      const badge = screen.getByText('Blocker');
      expect(badge.querySelector('svg')).not.toBeInTheDocument();
    });

    it('should show icon when showIcon is true', () => {
      render(<SeverityBadge severity={BugSeverity.BLOCKER} showIcon />);
      
      const badge = screen.getByText('Blocker');
      const icon = badge.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('h-3', 'w-3');
    });

    it('should show different icons for different severities', () => {
      const { rerender } = render(<SeverityBadge severity={BugSeverity.BLOCKER} showIcon />);
      let badge = screen.getByText('Blocker');
      let icon = badge.querySelector('svg');
      expect(icon).toBeInTheDocument();

      rerender(<SeverityBadge severity={BugSeverity.MAJOR} showIcon />);
      badge = screen.getByText('Major');
      icon = badge.querySelector('svg');
      expect(icon).toBeInTheDocument();

      rerender(<SeverityBadge severity={BugSeverity.MINOR} showIcon />);
      badge = screen.getByText('Minor');
      icon = badge.querySelector('svg');
      expect(icon).toBeInTheDocument();

      rerender(<SeverityBadge severity={BugSeverity.TRIVIAL} showIcon />);
      badge = screen.getByText('Trivial');
      icon = badge.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Custom styling', () => {
    it('should apply custom className', () => {
      render(<SeverityBadge severity={BugSeverity.BLOCKER} className="custom-class" />);
      
      const badge = screen.getByText('Blocker');
      expect(badge).toHaveClass('custom-class');
      expect(badge).toHaveClass('bg-red-100', 'text-red-800'); // Should still have base classes
    });

    it('should have default badge styling', () => {
      render(<SeverityBadge severity={BugSeverity.MINOR} />);
      
      const badge = screen.getByText('Minor');
      expect(badge).toHaveClass(
        'inline-flex',
        'items-center',
        'gap-1',
        'px-2.5',
        'py-0.5',
        'rounded-full',
        'text-xs',
        'font-medium'
      );
    });
  });

  describe('Dark mode styling', () => {
    it('should include dark mode classes for BLOCKER', () => {
      render(<SeverityBadge severity={BugSeverity.BLOCKER} />);
      
      const badge = screen.getByText('Blocker');
      expect(badge.className).toContain('dark:bg-red-900');
      expect(badge.className).toContain('dark:text-red-300');
    });

    it('should include dark mode classes for MAJOR', () => {
      render(<SeverityBadge severity={BugSeverity.MAJOR} />);
      
      const badge = screen.getByText('Major');
      expect(badge.className).toContain('dark:bg-orange-900');
      expect(badge.className).toContain('dark:text-orange-300');
    });

    it('should include dark mode classes for MINOR', () => {
      render(<SeverityBadge severity={BugSeverity.MINOR} />);
      
      const badge = screen.getByText('Minor');
      expect(badge.className).toContain('dark:bg-yellow-900');
      expect(badge.className).toContain('dark:text-yellow-300');
    });

    it('should include dark mode classes for TRIVIAL', () => {
      render(<SeverityBadge severity={BugSeverity.TRIVIAL} />);
      
      const badge = screen.getByText('Trivial');
      expect(badge.className).toContain('dark:bg-blue-900');
      expect(badge.className).toContain('dark:text-blue-300');
    });
  });
});