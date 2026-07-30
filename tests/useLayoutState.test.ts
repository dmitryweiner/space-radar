import { renderHook, act } from '@testing-library/react';
import { useLayoutState } from '../src/layout/useLayoutState';
import { STORAGE_KEY } from '../src/layout/layoutState';
import type { CardDefinition } from '../src/layout/types';

function Placeholder() {
  return null;
}

const registry: CardDefinition[] = [
  { id: 'a', title: 'A', defaultVisible: true, defaultLayout: { x: 0, y: 0, w: 2, h: 2 }, component: Placeholder },
  { id: 'b', title: 'B', defaultVisible: false, defaultLayout: { x: 2, y: 0, w: 1, h: 1 }, component: Placeholder },
];

beforeEach(() => {
  window.localStorage.clear();
});

describe('useLayoutState', () => {
  it('starts from registry defaults when localStorage is empty', () => {
    const { result } = renderHook(() => useLayoutState(registry));
    expect(result.current.visibleIds).toEqual(['a']);
    expect(result.current.layout.b).toEqual({ x: 2, y: 0, w: 1, h: 1 });
  });

  it('loads a previously persisted valid state', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ visibleIds: ['b'], layout: { a: { x: 0, y: 0, w: 2, h: 2 }, b: { x: 0, y: 2, w: 1, h: 1 } } }),
    );
    const { result } = renderHook(() => useLayoutState(registry));
    expect(result.current.visibleIds).toEqual(['b']);
    expect(result.current.layout.b).toEqual({ x: 0, y: 2, w: 1, h: 1 });
  });

  it('falls back to defaults without throwing when localStorage holds corrupted JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    const { result } = renderHook(() => useLayoutState(registry));
    expect(result.current.visibleIds).toEqual(['a']);
  });

  it('toggleVisible flips visibility and persists to localStorage', () => {
    const { result } = renderHook(() => useLayoutState(registry));
    act(() => {
      result.current.toggleVisible('b');
    });
    expect(result.current.visibleIds.sort()).toEqual(['a', 'b']);
    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    expect(persisted.visibleIds.sort()).toEqual(['a', 'b']);
  });

  it('updateLayout merges rects and persists to localStorage', () => {
    const { result } = renderHook(() => useLayoutState(registry));
    act(() => {
      result.current.updateLayout({ a: { x: 1, y: 1, w: 3, h: 3 } });
    });
    expect(result.current.layout.a).toEqual({ x: 1, y: 1, w: 3, h: 3 });
    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    expect(persisted.layout.a).toEqual({ x: 1, y: 1, w: 3, h: 3 });
  });

  it('resetLayout restores defaults and persists them, overwriting the customized state', () => {
    const { result } = renderHook(() => useLayoutState(registry));
    act(() => {
      result.current.toggleVisible('b');
      result.current.updateLayout({ a: { x: 1, y: 1, w: 3, h: 3 } });
    });
    act(() => {
      result.current.resetLayout();
    });
    expect(result.current.visibleIds).toEqual(['a']);
    expect(result.current.layout.a).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    expect(persisted.visibleIds).toEqual(['a']);
    expect(persisted.layout.a).toEqual({ x: 0, y: 0, w: 2, h: 2 });
  });
});
