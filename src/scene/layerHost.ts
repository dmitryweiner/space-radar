import { useEffect } from 'react';
import type { MarkerHit } from '../render/earthScene';
import type { LayerState } from '../layers/types';

/** A clicked marker, with the layer it belongs to (any scene). */
export interface LayerSelection {
  layerId: string;
  hit: MarkerHit;
}

/** What the panels need from a running layer — updated only on change. */
export type LayerStatusMap = Record<string, Pick<LayerState<unknown>, 'loading' | 'error' | 'summary' | 'legend'>>;

export type OnLayerStatus = (id: string, status: LayerStatusMap[string] | null) => void;

/** Latest full state per running layer, for the inspector's describe(). */
export type LayerStatesRef = React.MutableRefObject<Record<string, Pick<LayerState<unknown>, 'describe'>>>;

// Shared by the Earth and Solar System layer hosts: publish a layer's latest
// state for the inspector (in an effect — refs are off-limits during render),
// report its panel status only when that changes (not on every per-second
// position tick), and clear both when the layer goes away.
export function useReportLayerState(id: string, state: LayerState<unknown>, statesRef: LayerStatesRef, onStatus: OnLayerStatus) {
  useEffect(() => {
    statesRef.current[id] = state;
  });

  useEffect(
    () => () => {
      delete statesRef.current[id];
      onStatus(id, null);
    },
    [id, statesRef, onStatus],
  );

  const legendKey = state.legend.map((item) => `${item.label}:${item.color}`).join('|');
  const { loading, error, summary, legend } = state;
  useEffect(() => {
    onStatus(id, { loading, error, summary, legend });
    // legend is tracked through legendKey (a new array every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loading, error, summary, legendKey, onStatus]);
}
