import { useEffect, useState } from 'react';
import { useGlobalSettings } from './settings/useGlobalSettings';
import { GlobalSettingsPopup } from './settings/GlobalSettingsPopup';
import { SceneView } from './scene/SceneView';

export function App() {
  const globalSettings = useGlobalSettings();
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false);

  useEffect(() => {
    if (!generalSettingsOpen) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setGeneralSettingsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [generalSettingsOpen]);

  return (
    <div id="app">
      <header id="topbar">
        <span id="brand">Space Radar</span>
        <span className="tb-spacer" />
        <button
          id="generalSettingsBtn"
          type="button"
          className={generalSettingsOpen ? 'tb-btn tb-btn-active' : 'tb-btn'}
          aria-pressed={generalSettingsOpen}
          onClick={() => setGeneralSettingsOpen((open) => !open)}
        >
          <span className="tb-btn-label-full">Global settings</span>
          <span className="tb-btn-label-short">Settings</span>
        </button>
      </header>
      <SceneView
        labelScale={globalSettings.labelScale}
        rotateSpeed={globalSettings.rotateSpeed}
        dataSaver={globalSettings.dataSaver}
        startScene={globalSettings.startScene}
      />
      {generalSettingsOpen && (
        <GlobalSettingsPopup settings={globalSettings} onClose={() => setGeneralSettingsOpen(false)} />
      )}
    </div>
  );
}
