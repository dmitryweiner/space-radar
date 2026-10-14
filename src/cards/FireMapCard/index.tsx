import type { CardComponentProps } from '../../layout/types';
import { firesLayer } from '../../layers/firesLayer';
import { GlobeLayerCard } from '../GlobeLayerCard';

export function FireMapCard(props: CardComponentProps) {
  return <GlobeLayerCard layer={firesLayer} {...props} />;
}
