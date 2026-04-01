import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from '../components/common/KpiCard';

describe('KpiCard', () => {
  it('renders label and value', () => {
    render(<KpiCard label="Total MRR" value="$1.2K" />);
    expect(screen.getByText('Total MRR')).toBeInTheDocument();
    expect(screen.getByText('$1.2K')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<KpiCard label="Revenue" value="$500" icon="💰" />);
    expect(screen.getByText('💰')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<KpiCard label="Products" value="3" sub="2 active today" />);
    expect(screen.getByText('2 active today')).toBeInTheDocument();
  });

  it('applies variant class', () => {
    const { container } = render(<KpiCard label="MRR" value="$100" variant="highlight" />);
    expect(container.firstChild).toHaveClass('kpi-card');
    expect(container.firstChild).toHaveClass('highlight');
  });

  it('renders trend arrow when trend is provided', () => {
    render(<KpiCard label="Users" value="100" sub="vs last month" trend={{ direction: 'up', value: '+12%' }} />);
    expect(screen.getByText(/↑/)).toBeInTheDocument();
    expect(screen.getByText(/\+12%/)).toBeInTheDocument();
  });

  it('renders down trend correctly', () => {
    render(<KpiCard label="Churn" value="5%" sub="vs last month" trend={{ direction: 'down', value: '-3%' }} />);
    expect(screen.getByText(/↓/)).toBeInTheDocument();
  });
});
