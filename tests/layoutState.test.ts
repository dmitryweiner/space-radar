import {
  defaultState,
  sanitizeState,
  toggleVisibility,
  applyLayoutChange,
  applySettingsChange,
  cardSettingsWithDefaults,
  numberSetting,
  listSetting,
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

const settingsRegistry: CardDefinition[] = [
  {
    id: 'sat',
    title: 'Sat',
    defaultVisible: true,
    defaultLayout: { x: 0, y: 0, w: 2, h: 2 },
    component: Placeholder,
    settings: [
      { kind: 'number', id: 'count', label: 'Count', min: 5, max: 50, defaultValue: 10 },
      {
        kind: 'multiselect',
        id: 'groups',
        label: 'Groups',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
        defaultValue: ['a'],
      },
    ],
  },
];

describe('sanitizeState settings', () => {
  it('clamps numeric settings and filters multiselect values to known options', () => {
    const stored = {
      visibleIds: ['sat'],
      layout: { sat: { x: 0, y: 0, w: 2, h: 2 } },
      settings: { sat: { count: 999, groups: ['b', 'ghost'] } },
    };
    const result = sanitizeState(stored, settingsRegistry);
    expect(result.settings.sat).toEqual({ count: 50, groups: ['b'] });
  });

  it('drops an empty multiselect so the schema default takes over', () => {
    const stored = {
      visibleIds: ['sat'],
      layout: { sat: { x: 0, y: 0, w: 2, h: 2 } },
      settings: { sat: { groups: ['ghost'] } },
    };
    const result = sanitizeState(stored, settingsRegistry);
    expect(result.settings.sat.groups).toBeUndefined();
    expect(cardSettingsWithDefaults(settingsRegistry[0], result.settings.sat).groups).toEqual(['a']);
  });
});

describe('applySettingsChange', () => {
  it('merges per-card setting values without touching other cards', () => {
    const state = defaultState(settingsRegistry);
    const next = applySettingsChange(state, 'sat', { groups: ['a', 'b'] });
    expect(next.settings.sat).toEqual({ groups: ['a', 'b'] });
    const merged = applySettingsChange(next, 'sat', { count: 20 });
    expect(merged.settings.sat).toEqual({ groups: ['a', 'b'], count: 20 });
  });
});

describe('setting accessors', () => {
  it('numberSetting falls back when the value is missing or a list', () => {
    expect(numberSetting({ count: 12 }, 'count', 5)).toBe(12);
    expect(numberSetting({ groups: ['a'] }, 'groups', 5)).toBe(5);
    expect(numberSetting({}, 'count', 5)).toBe(5);
  });

  it('listSetting falls back when the value is missing or a number', () => {
    expect(listSetting({ groups: ['a', 'b'] }, 'groups', ['x'])).toEqual(['a', 'b']);
    expect(listSetting({ groups: 3 }, 'groups', ['x'])).toEqual(['x']);
    expect(listSetting({}, 'groups', ['x'])).toEqual(['x']);
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
