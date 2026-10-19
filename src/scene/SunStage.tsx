import { SolarImageryCard } from '../cards/SolarImageryCard';
import { SUN_PANELS, panelById } from './panels';

// The Sun tab: today's SDO image plus every panel about the Sun itself,
// laid out as one scrollable page.
export function SunStage() {
  return (
    <div className="sun-stage" data-testid="sun-stage">
      <section className="sun-tile">
        <SolarImageryCard settings={{ layers: ['0193'] }} />
      </section>
      {SUN_PANELS.map((id) => {
        const panel = panelById(id);
        if (!panel) return null;
        const Panel = panel.component;
        return (
          <section key={id} className={`sun-tile sun-tile-${id}`}>
            <h2 className="panel-heading">{panel.title}</h2>
            <div className="sun-tile-body">
              <Panel settings={panel.settings ?? {}} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
