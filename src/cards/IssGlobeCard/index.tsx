import type { CardComponentProps } from '../../layout/types';
import { issLayer } from '../../layers/issLayer';
import { GlobeLayerCard } from '../GlobeLayerCard';

export function IssGlobeCard(props: CardComponentProps) {
  return <GlobeLayerCard layer={issLayer} {...props} />;
}
