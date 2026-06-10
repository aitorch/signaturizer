import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SignatureDropdown from '../components/SignatureDropdown.svelte';

const mockSignatures = [
  { id: 'sig-1', name: 'My Signature', imageData: 'data:image/png;base64,abc' },
  { id: 'sig-2', name: 'Initials', imageData: 'data:image/png;base64,def' },
];

const defaultProps = {
  signatures: mockSignatures,
  isOpen: true,
  onSelect: vi.fn(),
  onDelete: vi.fn(),
  onCreateNew: vi.fn(),
  onClose: vi.fn(),
};

describe('SignatureDropdown', () => {
  it('renders "Create New Signature" option', () => {
    const { getByText } = render(SignatureDropdown, { props: defaultProps });
    expect(getByText('Create New Signature')).toBeDefined();
  });

  it('renders list of signatures with names', () => {
    const { getByText } = render(SignatureDropdown, { props: defaultProps });
    expect(getByText('My Signature')).toBeDefined();
    expect(getByText('Initials')).toBeDefined();
  });

  it('renders empty state when no signatures', () => {
    const { getByText } = render(SignatureDropdown, {
      props: { ...defaultProps, signatures: [] },
    });
    expect(getByText('No signatures yet. Create one!')).toBeDefined();
  });

  it('click "Create New" calls onCreateNew', async () => {
    const onCreateNew = vi.fn();
    const onClose = vi.fn();
    const { getByText } = render(SignatureDropdown, {
      props: { ...defaultProps, onCreateNew, onClose },
    });
    await fireEvent.click(getByText('Create New Signature'));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('click a signature calls onSelect with correct signature', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const { getByText } = render(SignatureDropdown, {
      props: { ...defaultProps, onSelect, onClose },
    });
    await fireEvent.click(getByText('My Signature'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(mockSignatures[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('delete flow: hover shows X, click X shows confirmation, click Yes calls onDelete', async () => {
    const onDelete = vi.fn();
    const { container, getByText } = render(SignatureDropdown, {
      props: { ...defaultProps, onDelete },
    });

    const deleteButtons = container.querySelectorAll('[title="Delete signature"]');
    expect(deleteButtons.length).toBe(2);

    // Click the first delete button (X)
    await fireEvent.click(deleteButtons[0]);

    // Confirmation should appear
    expect(getByText('Delete?')).toBeDefined();
    expect(getByText('Yes')).toBeDefined();
    expect(getByText('No')).toBeDefined();

    // Click Yes
    await fireEvent.click(getByText('Yes'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('sig-1');
  });

  it('click outside calls onClose', async () => {
    const onClose = vi.fn();
    render(SignatureDropdown, {
      props: { ...defaultProps, onClose },
    });

    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);

    await fireEvent.click(outsideEl);

    expect(onClose).toHaveBeenCalledTimes(1);

    document.body.removeChild(outsideEl);
  });

  it('cancel delete: click X then No hides confirmation without calling onDelete', async () => {
    const onDelete = vi.fn();
    const { container, getByText, queryByText } = render(SignatureDropdown, {
      props: { ...defaultProps, onDelete },
    });

    const deleteButtons = container.querySelectorAll('[title="Delete signature"]');
    await fireEvent.click(deleteButtons[0]);

    expect(getByText('Delete?')).toBeDefined();

    await fireEvent.click(getByText('No'));

    expect(onDelete).not.toHaveBeenCalled();
    expect(queryByText('Delete?')).toBeNull();
  });

  it('click inside dropdown does not call onClose', async () => {
    const onClose = vi.fn();
    const { getByText } = render(SignatureDropdown, {
      props: { ...defaultProps, onClose },
    });

    await fireEvent.click(getByText('My Signature'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('click inside container (not on a signature) does not call onClose', async () => {
    const onClose = vi.fn();
    const { container } = render(SignatureDropdown, {
      props: { ...defaultProps, onClose, signatures: [] },
    });

    const dropdown = container.querySelector('.absolute');
    await fireEvent.click(dropdown);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    const { queryByText } = render(SignatureDropdown, {
      props: { ...defaultProps, isOpen: false },
    });
    expect(queryByText('Create New Signature')).toBeNull();
  });
});
