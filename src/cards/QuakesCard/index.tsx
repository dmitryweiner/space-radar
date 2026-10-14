import type { CardComponentProps } from '../../layout/types';
import { quakesLayer } from '../../layers/quakesLayer';
import { GlobeLayerCard } from '../GlobeLayerCard';

export function QuakesCard(props: CardComponentProps) {
  return <GlobeLayerCard layer={quakesLayer} {...props} />;
}
