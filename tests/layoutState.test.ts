import {
  defaultState,
  sanitizeState,
  toggleVisibility,
  applyLayoutChange,
  applyMobileOrderChange,
  applySettingsChange,
  cardSettingsWithDefaults,
  numberSetting,
  listSetting,
  stringSetting,
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

  it('seeds mobileOrder with the visible cards in reading order (top-to-bottom, left-to-right)', () => {
    const state = defaultState(registry);
    expect(state.mobileOrder).toEqual(['a', 'c']);
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

  it('synthesizes mobileOrder in reading order when absent, e.g. storage saved before this field existed', () => {
    const stored = {
      visibleIds: ['a', 'c'],
      layout: { a: { x: 0, y: 0, w: 2, h: 2 }, c: { x: 0, y: 2, w: 1, h: 1 } },
    };
    const result = sanitizeState(stored, registry);
    expect(result.mobileOrder).toEqual(['a', 'c']);
  });

  it('keeps a stored mobileOrder, dropping ids that are unknown or no longer visible', () => {
    const stored = {
      visibleIds: ['a', 'c'],
      layout: { a: { x: 0, y: 0, w: 2, h: 2 }, c: { x: 0, y: 2, w: 1, h: 1 } },
      mobileOrder: ['c', 'ghost', 'b', 'a'],
    };
    const result = sanitizeState(stored, registry);
    // 'ghost' is unknown and 'b' isn't currently visible — both dropped, order preserved.
    expect(result.mobileOrder).toEqual(['c', 'a']);
  });

  it('appends a visible id missing from the stored mobileOrder instead of dropping it', () => {
    const stored = {
      visibleIds: ['a', 'c'],
      layout: { a: { x: 0, y: 0, w: 2, h: 2 }, c: { x: 0, y: 2, w: 1, h: 1 } },
      mobileOrder: ['c'],
    };
    const result = sanitizeState(stored, registry);
    expect(result.mobileOrder).toEqual(['c', 'a']);
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

  it('appends a newly shown card to the end of mobileOrder', () => {
    const state = defaultState(registry);
    const next = toggleVisibility(state, 'b');
    expect(next.mobileOrder).toEqual(['a', 'c', 'b']);
  });

  it('removes a hidden card from mobileOrder', () => {
    const state = defaultState(registry);
    const next = toggleVisibility(state, 'a');
    expect(next.mobileOrder).toEqual(['c']);
  });
});

describe('applyMobileOrderChange', () => {
  it('replaces mobileOrder without touching anything else', () => {
    const state = defaultState(registry);
    const next = applyMobileOrderChange(state, ['c', 'a']);
    expect(next.mobileOrder).toEqual(['c', 'a']);
    expect(next.visibleIds).toEqual(state.visibleIds);
    expect(next.layout).toEqual(state.layout);
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
      {
        kind: 'select',
        id: 'earthStyle',
        label: 'Earth style',
        options: [
          { value: 'globe', label: 'Globe' },
          { value: 'map', label: 'Map' },
        ],
        defaultValue: 'globe',
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

  it('keeps a select value that matches a known option', () => {
    const stored = {
      visibleIds: ['sat'],
      layout: { sat: { x: 0, y: 0, w: 2, h: 2 } },
      settings: { sat: { earthStyle: 'map' } },
    };
    const result = sanitizeState(stored, settingsRegistry);
    expect(result.settings.sat.earthStyle).toBe('map');
  });

  it('drops a select value that is not one of the known options', () => {
    const stored = {
      visibleIds: ['sat'],
      layout: { sat: { x: 0, y: 0, w: 2, h: 2 } },
      settings: { sat: { earthStyle: 'satellite-photo' } },
    };
    const result = sanitizeState(stored, settingsRegistry);
    expect(result.settings.sat.earthStyle).toBeUndefined();
    expect(cardSettingsWithDefaults(settingsRegistry[0], result.settings.sat).earthStyle).toBe('globe');
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

  it('stringSetting falls back when the value is missing or a list', () => {
    expect(stringSetting({ earthStyle: 'map' }, 'earthStyle', 'globe')).toBe('map');
    expect(stringSetting({ earthStyle: ['map'] }, 'earthStyle', 'globe')).toBe('globe');
    expect(stringSetting({}, 'earthStyle', 'globe')).toBe('globe');
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
