import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Toolbar from '../components/Toolbar.svelte';

describe('Toolbar', () => {
  const defaultProps = {
    onOpenPdf: vi.fn(),
    onExport: vi.fn(),
    onSign: vi.fn(),
    hasPdf: false,
    hasSignatures: false,
    currentPage: 1,
    totalPages: 1,
    zoom: 100,
    onPrevPage: vi.fn(),
    onNextPage: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
  };

  it('renders the Signaturizer title', () => {
    const { getByText } = render(Toolbar, { props: defaultProps });
    expect(getByText('Signaturizer')).toBeDefined();
  });

  it('renders Open PDF button', () => {
    const { getByText } = render(Toolbar, { props: defaultProps });
    expect(getByText('Open PDF')).toBeDefined();
  });

  it('renders Export button', () => {
    const { getByText } = render(Toolbar, { props: defaultProps });
    expect(getByText('Export')).toBeDefined();
  });

  it('renders Sign button', () => {
    const { getByText } = render(Toolbar, { props: defaultProps });
    expect(getByText('Sign')).toBeDefined();
  });

  it('calls onOpenPdf when Open PDF is clicked', async () => {
    const onOpenPdf = vi.fn();
    const { getByText } = render(Toolbar, {
      props: { ...defaultProps, onOpenPdf },
    });
    await fireEvent.click(getByText('Open PDF'));
    expect(onOpenPdf).toHaveBeenCalledTimes(1);
  });

  it('calls onExport when Export is clicked', async () => {
    const onExport = vi.fn();
    const { getByText } = render(Toolbar, {
      props: { ...defaultProps, onExport, hasPdf: true },
    });
    await fireEvent.click(getByText('Export'));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('calls onSign when Sign is clicked', async () => {
    const onSign = vi.fn();
    const { getByText } = render(Toolbar, {
      props: { ...defaultProps, onSign, hasPdf: true },
    });
    await fireEvent.click(getByText('Sign'));
    expect(onSign).toHaveBeenCalledTimes(1);
  });

  it('disables Export button when hasPdf is false', () => {
    const { getByText } = render(Toolbar, {
      props: { ...defaultProps, hasPdf: false },
    });
    const exportBtn = getByText('Export').closest('button');
    expect(exportBtn.disabled).toBe(true);
  });

  it('disables Sign button when hasPdf is false', () => {
    const { getByText } = render(Toolbar, {
      props: { ...defaultProps, hasPdf: false },
    });
    const signBtn = getByText('Sign').closest('button');
    expect(signBtn.disabled).toBe(true);
  });

  it('enables Export button when hasPdf is true', () => {
    const { getByText } = render(Toolbar, {
      props: { ...defaultProps, hasPdf: true },
    });
    const exportBtn = getByText('Export').closest('button');
    expect(exportBtn.disabled).toBe(false);
  });

  it('enables Sign button when hasPdf is true', () => {
    const { getByText } = render(Toolbar, {
      props: { ...defaultProps, hasPdf: true },
    });
    const signBtn = getByText('Sign').closest('button');
    expect(signBtn.disabled).toBe(false);
  });

  it('shows page navigation when hasPdf is true', () => {
    const { getByText } = render(Toolbar, {
      props: { ...defaultProps, hasPdf: true, currentPage: 2, totalPages: 5 },
    });
    expect(getByText('2 / 5')).toBeDefined();
  });

  it('hides page navigation when hasPdf is false', () => {
    const { container } = render(Toolbar, {
      props: { ...defaultProps, hasPdf: false },
    });
    const pageDisplay = container.textContent;
    expect(pageDisplay).not.toMatch(/\d+ \/ \d+/);
  });

  it('shows zoom controls when hasPdf is true', () => {
    const { getByText } = render(Toolbar, {
      props: { ...defaultProps, hasPdf: true, zoom: 100 },
    });
    expect(getByText('100%')).toBeDefined();
  });

  it('disables previous page button on first page', () => {
    const { getByTitle } = render(Toolbar, {
      props: { ...defaultProps, hasPdf: true, currentPage: 1, totalPages: 5 },
    });
    const prevBtn = getByTitle('Previous page');
    expect(prevBtn.disabled).toBe(true);
  });

  it('disables next page button on last page', () => {
    const { getByTitle } = render(Toolbar, {
      props: { ...defaultProps, hasPdf: true, currentPage: 5, totalPages: 5 },
    });
    const nextBtn = getByTitle('Next page');
    expect(nextBtn.disabled).toBe(true);
  });

  it('calls onPrevPage when previous page button is clicked', async () => {
    const onPrevPage = vi.fn();
    const { getByTitle } = render(Toolbar, {
      props: { ...defaultProps, onPrevPage, hasPdf: true, currentPage: 3, totalPages: 5 },
    });
    await fireEvent.click(getByTitle('Previous page'));
    expect(onPrevPage).toHaveBeenCalledTimes(1);
  });

  it('calls onNextPage when next page button is clicked', async () => {
    const onNextPage = vi.fn();
    const { getByTitle } = render(Toolbar, {
      props: { ...defaultProps, onNextPage, hasPdf: true, currentPage: 3, totalPages: 5 },
    });
    await fireEvent.click(getByTitle('Next page'));
    expect(onNextPage).toHaveBeenCalledTimes(1);
  });

  it('calls onZoomIn when zoom in button is clicked', async () => {
    const onZoomIn = vi.fn();
    const { getByTitle } = render(Toolbar, {
      props: { ...defaultProps, onZoomIn, hasPdf: true },
    });
    await fireEvent.click(getByTitle('Zoom in'));
    expect(onZoomIn).toHaveBeenCalledTimes(1);
  });

  it('calls onZoomOut when zoom out button is clicked', async () => {
    const onZoomOut = vi.fn();
    const { getByTitle } = render(Toolbar, {
      props: { ...defaultProps, onZoomOut, hasPdf: true },
    });
    await fireEvent.click(getByTitle('Zoom out'));
    expect(onZoomOut).toHaveBeenCalledTimes(1);
  });

  it('applies disabled styling classes to disabled buttons', () => {
    const { getByText } = render(Toolbar, {
      props: { ...defaultProps, hasPdf: false },
    });
    const exportBtn = getByText('Export').closest('button');
    expect(exportBtn.classList.contains('disabled:opacity-50')).toBe(true);
    expect(exportBtn.classList.contains('disabled:cursor-not-allowed')).toBe(true);
  });

  it('applies focus-visible ring classes to all buttons', () => {
    const { container } = render(Toolbar, {
      props: { ...defaultProps, hasPdf: true, currentPage: 2, totalPages: 5 },
    });
    const buttons = container.querySelectorAll('button');
    for (const btn of buttons) {
      expect(btn.classList.contains('focus-visible:ring-2')).toBe(true);
      expect(btn.classList.contains('focus-visible:ring-indigo-500')).toBe(true);
      expect(btn.classList.contains('focus-visible:ring-offset-1')).toBe(true);
    }
  });
});
