import type { EarthLayerHandle } from '../render/earthScene';
import type { LayerFrame } from './types';

// Push a layer's frame into a globe layer. Only the fields the frame carries
// are touched, so e.g. the ISS layer never clears another layer's markers and
// an empty "still loading" frame ({}) draws nothing at all.
export function applyFrame(target: EarthLayerHandle, frame: LayerFrame): void {
  if (frame.iss !== undefined) {
    target.setIssPosition(frame.iss ? frame.iss.position : null, frame.iss ? frame.iss.trail : []);
  }
  if (frame.satellites) {
    target.setSatellites(frame.satellites);
  }
  if (frame.markers) {
    target.setMarkers(frame.markers);
  }
  if (frame.firePoints) {
    target.setFirePoints(frame.firePoints);
  }
  if (frame.auroraPoints) {
    target.setAuroraPoints(frame.auroraPoints);
  }
  if (frame.nightLights !== undefined) {
    target.setNightLights(frame.nightLights);
  }
  if (frame.tracks) {
    target.setTracks(frame.tracks);
  }
}
