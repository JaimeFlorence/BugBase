import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';
import { BugStatus } from '../../types';

describe('StatusBadge', () => {
  it('should render NEW status correctly', () => {
    render(<StatusBadge status={BugStatus.NEW} />);
    
    const badge = screen.getByText('New');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('should render IN_PROGRESS status correctly', () => {
    render(<StatusBadge status={BugStatus.IN_PROGRESS} />);
    
    const badge = screen.getByText('In Progress');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('should render TESTING status correctly', () => {
    render(<StatusBadge status={BugStatus.TESTING} />);
    
    const badge = screen.getByText('Testing');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-purple-100', 'text-purple-800');
  });

  it('should render RESOLVED status correctly', () => {
    render(<StatusBadge status={BugStatus.RESOLVED} />);
    
    const badge = screen.getByText('Resolved');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('should render CLOSED status correctly', () => {
    render(<StatusBadge status={BugStatus.CLOSED} />);
    
    const badge = screen.getByText('Closed');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  it('should render REOPENED status correctly', () => {
    render(<StatusBadge status={BugStatus.REOPENED} />);
    
    const badge = screen.getByText('Reopened');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-orange-100', 'text-orange-800');
  });

  it('should apply additional className prop', () => {
    render(<StatusBadge status={BugStatus.NEW} className="custom-class" />);
    
    const badge = screen.getByText('New');
    expect(badge).toHaveClass('custom-class');
  });

  it('should have default styling classes', () => {
    render(<StatusBadge status={BugStatus.NEW} />);
    
    const badge = screen.getByText('New');
    expect(badge).toHaveClass(
      'inline-flex',
      'items-center',
      'px-2.5',
      'py-0.5',
      'rounded-full',
      'text-xs',
      'font-medium'
    );
  });
});