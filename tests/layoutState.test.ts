import {
  defaultState,
  sanitizeState,
  toggleVisibility,
  applyLayoutChange,
} from '../src/layout/layoutState';
import type { CardDefinition } from '../src/layout/types';

function Placeholder() {
  return null;
}

const registry: CardDefinition[] = [
  { id: 'a', title: 'A', defaultVisible: true, defaultLayout: { x: 0, y: 0, w: 2, h: 2 }, component: Placeholder },
  { id: 'b', title: 'B', defaultVisible: false, defaultLayout: { x: 2, y: 0, w: 1, h: 1 }, component: Placeholder },
  { id: 'c', title: 'C', defaultVisible: true, defaultLayout: { x: 0, y: 2, w: 1, h: 1 }, component: Placeholder },
];

describe('defaultState', () => {
  it('marks only defaultVisible cards as visible', () => {
    const state = defaultState(registry);
    expect(state.visibleIds.sort()).toEqual(['a', 'c']);
  });

  it('includes a layout rect for every registered card, not just visible ones', () => {
    const state = defaultState(registry);
    expect(Object.keys(state.layout).sort()).toEqual(['a', 'b', 'c']);
    expect(state.layout.b).toEqual({ x: 2, y: 0, w: 1, h: 1 });
  });
});

describe('sanitizeState', () => {
  it('returns the default state when input is not an object', () => {
    expect(sanitizeState(null, registry)).toEqual(defaultState(registry));
    expect(sanitizeState('garbage', registry)).toEqual(defaultState(registry));
    expect(sanitizeState(42, registry)).toEqual(defaultState(registry));
  });

  it('returns the default state when required fields are missing or malformed', () => {
    expect(sanitizeState({ visibleIds: 'nope' }, registry)).toEqual(defaultState(registry));
    expect(sanitizeState({ visibleIds: [], layout: 'nope' }, registry)).toEqual(defaultState(registry));
  });

  it('keeps a valid stored state, filtering out unknown card ids', () => {
    const stored = {
      visibleIds: ['a', 'ghost'],
      layout: {
        a: { x: 1, y: 1, w: 2, h: 2 },
        b: { x: 2, y: 0, w: 1, h: 1 },
        ghost: { x: 9, y: 9, w: 1, h: 1 },
      },
    };
    const result = sanitizeState(stored, registry);
    expect(result.visibleIds).toEqual(['a']);
    expect(Object.keys(result.layout).sort()).toEqual(['a', 'b', 'c']);
    expect(result.layout.a).toEqual({ x: 1, y: 1, w: 2, h: 2 });
  });

  it('fills in missing registry cards with their default layout, e.g. a card added after the state was saved', () => {
    const stored = {
      visibleIds: ['a'],
      layout: { a: { x: 0, y: 0, w: 2, h: 2 } },
    };
    const result = sanitizeState(stored, registry);
    expect(result.layout.c).toEqual({ x: 0, y: 2, w: 1, h: 1 });
  });
});

describe('toggleVisibility', () => {
  it('adds a hidden card id to visibleIds', () => {
    const state = defaultState(registry);
    const next = toggleVisibility(state, 'b');
    expect(next.visibleIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('removes a visible card id from visibleIds', () => {
    const state = defaultState(registry);
    const next = toggleVisibility(state, 'a');
    expect(next.visibleIds.sort()).toEqual(['c']);
  });

  it('does not mutate the input state', () => {
    const state = defaultState(registry);
    const before = [...state.visibleIds];
    toggleVisibility(state, 'b');
    expect(state.visibleIds).toEqual(before);
  });
});

describe('applyLayoutChange', () => {
  it('merges new rects into the layout by id', () => {
    const state = defaultState(registry);
    const next = applyLayoutChange(state, { a: { x: 3, y: 3, w: 2, h: 2 } });
    expect(next.layout.a).toEqual({ x: 3, y: 3, w: 2, h: 2 });
    expect(next.layout.b).toEqual(state.layout.b);
  });

  it('leaves visibleIds untouched', () => {
    const state = defaultState(registry);
    const next = applyLayoutChange(state, { a: { x: 3, y: 3, w: 2, h: 2 } });
    expect(next.visibleIds).toEqual(state.visibleIds);
  });
});
