import { render, screen } from '@testing-library/react';
import { PriorityBadge } from '../PriorityBadge';
import { BugPriority } from '../../types';

describe('PriorityBadge', () => {
  it('should render CRITICAL priority correctly', () => {
    render(<PriorityBadge priority={BugPriority.CRITICAL} />);
    
    const badge = screen.getByText('Critical');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('should render HIGH priority correctly', () => {
    render(<PriorityBadge priority={BugPriority.HIGH} />);
    
    const badge = screen.getByText('High');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-orange-100', 'text-orange-800');
  });

  it('should render MEDIUM priority correctly', () => {
    render(<PriorityBadge priority={BugPriority.MEDIUM} />);
    
    const badge = screen.getByText('Medium');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('should render LOW priority correctly', () => {
    render(<PriorityBadge priority={BugPriority.LOW} />);
    
    const badge = screen.getByText('Low');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('should show icon when showIcon is true', () => {
    render(<PriorityBadge priority={BugPriority.CRITICAL} showIcon={true} />);
    
    const badge = screen.getByText('Critical');
    expect(badge).toBeInTheDocument();
    
    // Check if there's an SVG element (icon) inside the badge
    const icon = badge.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('h-3', 'w-3');
  });

  it('should not show icon when showIcon is false', () => {
    render(<PriorityBadge priority={BugPriority.CRITICAL} showIcon={false} />);
    
    const badge = screen.getByText('Critical');
    expect(badge).toBeInTheDocument();
    
    // Check that there's no SVG element (icon) inside the badge
    const icon = badge.querySelector('svg');
    expect(icon).not.toBeInTheDocument();
  });

  it('should not show icon by default', () => {
    render(<PriorityBadge priority={BugPriority.CRITICAL} />);
    
    const badge = screen.getByText('Critical');
    expect(badge).toBeInTheDocument();
    
    // Check that there's no SVG element (icon) inside the badge
    const icon = badge.querySelector('svg');
    expect(icon).not.toBeInTheDocument();
  });

  it('should apply additional className prop', () => {
    render(<PriorityBadge priority={BugPriority.CRITICAL} className="custom-class" />);
    
    const badge = screen.getByText('Critical');
    expect(badge).toHaveClass('custom-class');
  });

  it('should have default styling classes', () => {
    render(<PriorityBadge priority={BugPriority.CRITICAL} />);
    
    const badge = screen.getByText('Critical');
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