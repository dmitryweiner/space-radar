import type { CardComponentProps } from '../../layout/types';
import { auroraLayer } from '../../layers/auroraLayer';
import { GlobeLayerCard } from '../GlobeLayerCard';

export function AuroraGlobeCard(props: CardComponentProps) {
  return <GlobeLayerCard layer={auroraLayer} {...props} />;
}
