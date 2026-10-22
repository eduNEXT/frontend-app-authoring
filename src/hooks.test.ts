import { act, fireEvent, renderHook } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { history } from '@edx/frontend-platform';

import { useScrollToHashElement, useEscapeClick, useLoadOnScroll } from './hooks';

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn(),
}));

jest.mock('@edx/frontend-platform', () => ({
  history: {
    replace: jest.fn(),
  },
}));

describe('Custom Hooks', () => {
  describe('useScrollToHashElement', () => {
    beforeEach(() => {
      window.location.hash = '#test';
      document.body.innerHTML = '<div id="test">Test Element</div>';

      Element.prototype.scrollIntoView = jest.fn();

      jest.mocked(useLocation).mockReturnValue({
        pathname: '/test',
        state: null,
        search: '',
        hash: '',
        key: 'default',
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
      window.location.hash = '';
    });

    it('scrolls to element with the hash and replaces the URL hash', () => {
      renderHook(() => useScrollToHashElement({ isLoading: false }));
      const element = document.getElementById('test');

      expect(element).toBeInTheDocument();
      expect(element?.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
      expect(history.replace).toHaveBeenCalledWith({ pathname: '/test', hash: '' });
    });
  });

  describe('useEscapeClick', () => {
    it('calls onEscape when Escape key is pressed', () => {
      const onEscape = jest.fn();

      renderHook(() => useEscapeClick({ onEscape, dependency: [] }));

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('does not call onEscape for other keys', () => {
      const onEscape = jest.fn();

      renderHook(() => useEscapeClick({ onEscape, dependency: [] }));

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(onEscape).not.toHaveBeenCalled();
    });
  });

  describe('useLoadOnScroll', () => {
    const fetchNextPage = jest.fn();
    let observers: {
      callback: IntersectionObserverCallback,
      observe: jest.Mock,
      disconnect: jest.Mock,
    }[];
    let originalIntersectionObserver: typeof IntersectionObserver;

    /** Simulates the sentinel entering or leaving the visible area. */
    const setSentinelVisible = (isIntersecting: boolean) => {
      const observer = observers[observers.length - 1];
      act(() => {
        observer.callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
      });
    };

    const renderLoadOnScroll = (initialProps: {
      hasNextPage: boolean,
      isFetchingNextPage: boolean,
      enabled?: boolean,
    }) => {
      const sentinel = document.createElement('div');
      const result = renderHook(
        ({ hasNextPage, isFetchingNextPage, enabled = true }) => useLoadOnScroll(
          hasNextPage,
          isFetchingNextPage,
          fetchNextPage,
          enabled,
        ),
        { initialProps },
      );
      act(() => {
        result.result.current(sentinel);
      });
      return { ...result, sentinel };
    };

    beforeEach(() => {
      observers = [];
      originalIntersectionObserver = global.IntersectionObserver;
      global.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
        const observer = { callback, observe: jest.fn(), disconnect: jest.fn() };
        observers.push(observer);
        return observer;
      }) as unknown as typeof IntersectionObserver;
    });

    afterEach(() => {
      global.IntersectionObserver = originalIntersectionObserver;
      jest.clearAllMocks();
    });

    it('observes the sentinel element', () => {
      const { sentinel } = renderLoadOnScroll({ hasNextPage: true, isFetchingNextPage: false });

      expect(observers).toHaveLength(1);
      expect(observers[0].observe).toHaveBeenCalledWith(sentinel);
    });

    it('calls fetchNextPage when the sentinel becomes visible', () => {
      renderLoadOnScroll({ hasNextPage: true, isFetchingNextPage: false });

      setSentinelVisible(false);
      expect(fetchNextPage).not.toHaveBeenCalled();

      setSentinelVisible(true);
      expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });

    it('keeps fetching pages while the sentinel is still visible after a page loads', () => {
      const { rerender } = renderLoadOnScroll({ hasNextPage: true, isFetchingNextPage: false });

      // The first page doesn't fill the container, so the sentinel is visible.
      setSentinelVisible(true);
      expect(fetchNextPage).toHaveBeenCalledTimes(1);

      // While fetching, the observer is disconnected.
      rerender({ hasNextPage: true, isFetchingNextPage: true });
      expect(observers[0].disconnect).toHaveBeenCalled();

      // Once the page is loaded, a new observer reports that the sentinel is still visible.
      rerender({ hasNextPage: true, isFetchingNextPage: false });
      expect(observers).toHaveLength(2);
      setSentinelVisible(true);
      expect(fetchNextPage).toHaveBeenCalledTimes(2);

      // After the next page fills the container, the sentinel is no longer visible.
      rerender({ hasNextPage: true, isFetchingNextPage: true });
      rerender({ hasNextPage: true, isFetchingNextPage: false });
      setSentinelVisible(false);
      expect(fetchNextPage).toHaveBeenCalledTimes(2);
    });

    it('does not observe the sentinel if fetching is in progress', () => {
      renderLoadOnScroll({ hasNextPage: true, isFetchingNextPage: true });

      expect(observers).toHaveLength(0);
    });

    it('does not observe the sentinel if hasNextPage is false', () => {
      renderLoadOnScroll({ hasNextPage: false, isFetchingNextPage: false });

      expect(observers).toHaveLength(0);
    });

    it('does not observe the sentinel if disabled', () => {
      renderLoadOnScroll({ hasNextPage: true, isFetchingNextPage: false, enabled: false });

      expect(observers).toHaveLength(0);
    });

    it('disconnects the observer on unmount', () => {
      const { unmount } = renderLoadOnScroll({ hasNextPage: true, isFetchingNextPage: false });

      unmount();

      expect(observers[0].disconnect).toHaveBeenCalled();
    });
  });
});
