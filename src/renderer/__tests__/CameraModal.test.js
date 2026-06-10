import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CameraModal from '../components/CameraModal.svelte';

beforeEach(() => {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
        getVideoTracks: () => [],
      }),
      enumerateDevices: vi.fn().mockResolvedValue([]),
    },
    writable: true,
  });
});

describe('CameraModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(CameraModal, {
      props: { isOpen: false, onCapture: vi.fn(), onCancel: vi.fn() },
    });
    expect(container.querySelector('.fixed')).toBeNull();
  });

  it('renders the modal when isOpen is true', () => {
    const { getByText } = render(CameraModal, {
      props: { isOpen: true, onCapture: vi.fn(), onCancel: vi.fn() },
    });
    expect(getByText('Camera Capture')).toBeDefined();
  });

  it('Cancel button calls onCancel', async () => {
    const onCancel = vi.fn();
    const { getByText } = render(CameraModal, {
      props: { isOpen: true, onCapture: vi.fn(), onCancel },
    });
    await fireEvent.click(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Close button (X) calls onCancel', async () => {
    const onCancel = vi.fn();
    const { container } = render(CameraModal, {
      props: { isOpen: true, onCapture: vi.fn(), onCancel },
    });
    const closeBtn = container.querySelector('button[title="Close"]');
    await fireEvent.click(closeBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
