import { derivePhysics } from '../math/physics';
import type { FlightTelemetry } from '../camera/CameraController';
import type {
  CameraPreset,
  QualityPreset,
  SimulationSnapshot,
  SimulationStore,
} from '../state/SimulationStore';

const numericControls = new Set(['mass', 'spin', 'diskHeat', 'lensing', 'timeScale']);
const qualityPresets = new Set<QualityPreset>(['auto', 'high', 'balanced', 'performance']);
const cameraPresets = new Set<CameraPreset>([
  'observatory',
  'edge',
  'polar',
  'wide',
  'cockpit',
]);

export interface ScienceDeckOptions {
  onReset?: () => void;
}

const deckMarkup = `
  <div class="cockpit-shell" aria-hidden="true">
    <div class="cockpit-glass"></div>
    <div class="capture-vignette"></div>
    <div class="cockpit-canopy">
      <span class="cockpit-strut cockpit-strut--left"></span>
      <span class="cockpit-strut cockpit-strut--right"></span>
      <span class="cockpit-header-beam"></span>
    </div>
    <div class="cockpit-hud">
      <div class="cockpit-hud-block cockpit-hud-block--left">
        <b>RANGER 07</b>
        <span>FORWARD FLIGHT CONTROL</span>
        <i data-flight-mode>PILOT / MANUAL</i>
      </div>
      <div class="cockpit-hud-block cockpit-hud-block--right">
        <b>PROXIMITY</b>
        <span><span data-flight-distance>3.70</span> R<sub>S</sub></span>
        <i><span data-flight-speed>0.00</span> R<sub>S</sub>/S</i>
      </div>
      <div class="cockpit-reticle">
        <i></i><span></span><b data-flight-status>VECTOR HOLD</b>
      </div>
    </div>
    <div class="cockpit-console">
      <div class="cockpit-panel cockpit-panel--left"><span></span><span></span><span></span></div>
      <div class="cockpit-panel cockpit-panel--center"><i></i><b>MANUAL VECTOR</b><i></i></div>
      <div class="cockpit-panel cockpit-panel--right"><span></span><span></span><span></span></div>
    </div>
  </div>

  <div class="interface-layer">
    <div class="cinematic-frame" aria-hidden="true">
      <span class="frame-corner frame-corner--tl"></span>
      <span class="frame-corner frame-corner--tr"></span>
      <span class="frame-corner frame-corner--bl"></span>
      <span class="frame-corner frame-corner--br"></span>
      <span class="horizon-mark"><i></i><b>EVENT HORIZON</b><i></i></span>
    </div>

    <header class="mission-title">
      <div class="mission-kicker"><span class="status-pulse"></span> LIVE RELATIVISTIC MODEL</div>
      <h1>GARGANTUA</h1>
      <p>ROTATING SUPERMASSIVE BLACK HOLE</p>
      <div class="title-rule"><span></span></div>
    </header>

    <aside class="science-deck" aria-label="Black hole science controls">
      <div class="deck-rail" aria-hidden="true"><span>GRAV / 01</span><i></i></div>
      <header class="deck-header">
        <div>
          <span class="deck-overline">OBSERVATION ARRAY</span>
          <h2>SCIENCE DECK</h2>
        </div>
        <button class="icon-button" type="button" data-action="collapse" aria-expanded="true" aria-label="Collapse science deck">
          <span></span><span></span>
        </button>
      </header>

      <div class="deck-body">
        <section class="telemetry" aria-label="Live telemetry">
          <div class="telemetry-primary">
            <span>MASS</span>
            <strong data-readout="mass">4.1</strong>
            <small>MILLION M<sub>☉</sub></small>
          </div>
          <div class="telemetry-row">
            <div><span>SCHWARZSCHILD RADIUS</span><strong data-readout="radius">12,109,350 KM</strong></div>
            <div><span>DIMENSIONLESS SPIN</span><strong data-readout="spin">a* 0.72</strong></div>
          </div>
        </section>

        <section class="control-section" aria-labelledby="physical-controls-title">
          <div class="section-heading"><span id="physical-controls-title">PHYSICAL PARAMETERS</span><i>01</i></div>
          <div class="control-row">
            <div class="control-label"><label for="mass-control">Mass</label><output data-output="mass">4.1 M</output></div>
            <input id="mass-control" data-control="mass" type="range" min="0.5" max="40" step="0.1" value="4.1" />
          </div>
          <div class="control-row">
            <div class="control-label"><label for="spin-control">Angular momentum</label><output data-output="spin">0.72 a*</output></div>
            <input id="spin-control" data-control="spin" type="range" min="0" max="0.99" step="0.01" value="0.72" />
          </div>
          <div class="control-row">
            <div class="control-label"><label for="heat-control">Accretion heat</label><output data-output="diskHeat">58%</output></div>
            <input id="heat-control" data-control="diskHeat" type="range" min="0" max="1" step="0.01" value="0.58" />
          </div>
          <div class="control-row">
            <div class="control-label"><label for="lensing-control">Lensing intensity</label><output data-output="lensing">1.00×</output></div>
            <input id="lensing-control" data-control="lensing" type="range" min="0.65" max="1.35" step="0.01" value="1" />
          </div>
          <div class="control-row">
            <div class="control-label"><label for="time-control">Time flow</label><output data-output="timeScale">1.00×</output></div>
            <input id="time-control" data-control="timeScale" type="range" min="0" max="2" step="0.05" value="1" />
          </div>
        </section>

        <section class="view-section" aria-labelledby="viewpoints-title">
          <div class="section-heading"><span id="viewpoints-title">CAMERA TRAJECTORY</span><i>02</i></div>
          <div class="view-grid">
            <button type="button" data-camera-preset="observatory" aria-pressed="true"><b>01</b><span>Observatory</span></button>
            <button type="button" data-camera-preset="edge" aria-pressed="false"><b>02</b><span>Edge of light</span></button>
            <button type="button" data-camera-preset="polar" aria-pressed="false"><b>03</b><span>Polar crown</span></button>
            <button type="button" data-camera-preset="wide" aria-pressed="false"><b>04</b><span>Wide orbit</span></button>
            <button type="button" data-camera-preset="cockpit" aria-pressed="false"><b>05</b><span>Flight deck</span></button>
          </div>
        </section>

        <section class="system-section" aria-labelledby="system-title">
          <div class="section-heading"><span id="system-title">RENDER SYSTEM</span><i>03</i></div>
          <label class="select-label" for="quality-control">Quality profile</label>
          <div class="select-wrap">
            <select id="quality-control" data-control="quality">
              <option value="auto">AUTO / ADAPTIVE</option>
              <option value="high">HIGH / 96 STEPS</option>
              <option value="balanced">BALANCED / 80 STEPS</option>
              <option value="performance">PERFORMANCE / 64 STEPS</option>
            </select>
          </div>
        </section>

        <div class="deck-actions">
          <button type="button" data-action="pause"><span data-pause-label>PAUSE TIME</span><kbd>SPACE</kbd></button>
          <button type="button" data-action="reset">RESET MODEL <kbd>R</kbd></button>
          <button type="button" data-action="hide">HIDE INTERFACE <kbd>H</kbd></button>
        </div>
      </div>
    </aside>

    <footer class="interaction-guide" aria-label="Interaction guide">
      <span class="orbit-guide"><i class="mouse-icon"></i> DRAG <b>ORBIT</b></span>
      <span class="orbit-guide"><i class="scroll-icon"></i> SCROLL <b>RANGE</b></span>
      <span class="flight-guide"><kbd>W/S</kbd> <b>THRUST</b></span>
      <span class="flight-guide"><kbd>A/D</kbd> <b>STRAFE</b></span>
      <span class="flight-guide"><kbd>Q/E</kbd> <b>LIFT</b></span>
      <span class="flight-guide"><i class="mouse-icon"></i> DRAG <b>STEER</b></span>
      <span class="coordinate-readout">RA 17H 45M 40S <em>/</em> DEC −29° 00′ 28″</span>
    </footer>
  </div>
`;

export class ScienceDeck {
  private root: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private collapsed = false;

  constructor(
    private readonly store: SimulationStore,
    private readonly options: ScienceDeckOptions = {},
  ) {}

  mount(root: HTMLElement): void {
    this.root = root;
    root.innerHTML = deckMarkup;
    this.collapsed = window.matchMedia?.('(max-width: 900px)').matches ?? false;
    if (this.collapsed) {
      root.querySelector('.science-deck')?.classList.add('is-collapsed');
      const collapseButton = root.querySelector<HTMLElement>('[data-action="collapse"]');
      collapseButton?.setAttribute('aria-expanded', 'false');
      collapseButton?.setAttribute('aria-label', 'Expand science deck');
    }
    root.addEventListener('input', this.handleInput);
    root.addEventListener('click', this.handleClick);
    this.unsubscribe = this.store.subscribe(this.render);
    this.render(this.store.getSnapshot());
  }

  showFallback(message: string): void {
    if (!this.root) return;
    this.root.classList.remove('ui-hidden');
    this.root.innerHTML = `
      <div class="renderer-fallback" role="alert">
        <span class="fallback-code">RENDER SYSTEM / OFFLINE</span>
        <h1>SPACETIME<br />UNAVAILABLE</h1>
        <p>${message}</p>
        <small>Enable hardware acceleration or open this experience in a modern desktop browser.</small>
      </div>`;
  }

  updateFlightTelemetry(telemetry: Readonly<FlightTelemetry>): void {
    if (!this.root) return;
    this.setText('[data-flight-distance]', telemetry.distance.toFixed(2));
    this.setText('[data-flight-speed]', telemetry.speed.toFixed(2));
    this.setText(
      '[data-flight-mode]',
      telemetry.captured ? 'GRAVITY / CAPTURE' : telemetry.active ? 'PILOT / MANUAL' : 'NAV / LOCKED',
    );
    this.setText(
      '[data-flight-status]',
      telemetry.horizonCrossed
        ? 'EVENT HORIZON'
        : telemetry.captured
          ? 'GRAVITY LOCK'
          : telemetry.active && telemetry.speed > 0.03
            ? 'VECTOR ACTIVE'
            : 'VECTOR HOLD',
    );
    this.root.style.setProperty(
      '--cockpit-bank',
      `${(-telemetry.strafe * 0.8).toFixed(1)}deg`,
    );
    this.root.classList.toggle(
      'is-thrusting',
      telemetry.active && Math.abs(telemetry.thrust) > 0.01,
    );
    this.root.classList.toggle('is-captured', telemetry.captured);
    this.root.classList.toggle('is-horizon-crossed', telemetry.horizonCrossed);
    this.root.style.setProperty(
      '--capture-progress',
      telemetry.horizonProgress.toFixed(3),
    );
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.root) {
      this.root.removeEventListener('input', this.handleInput);
      this.root.removeEventListener('click', this.handleClick);
      this.root.replaceChildren();
      this.root.classList.remove(
        'ui-hidden',
        'is-cockpit',
        'is-thrusting',
        'is-captured',
        'is-horizon-crossed',
      );
      this.root.style.removeProperty('--cockpit-bank');
      this.root.style.removeProperty('--capture-progress');
    }
    this.root = null;
    this.collapsed = false;
  }

  private readonly render = (snapshot: SimulationSnapshot): void => {
    if (!this.root) return;
    const physics = derivePhysics(snapshot);
    this.setText('[data-readout="mass"]', snapshot.mass.toFixed(1));
    this.setText('[data-readout="radius"]', `${Math.round(physics.schwarzschildRadiusKm).toLocaleString('en-US')} KM`);
    this.setText('[data-readout="spin"]', `a* ${snapshot.spin.toFixed(2)}`);
    this.setText('[data-output="mass"]', `${snapshot.mass.toFixed(1)} M`);
    this.setText('[data-output="spin"]', `${snapshot.spin.toFixed(2)} a*`);
    this.setText('[data-output="diskHeat"]', `${Math.round(snapshot.diskHeat * 100)}%`);
    this.setText('[data-output="lensing"]', `${snapshot.lensing.toFixed(2)}×`);
    this.setText('[data-output="timeScale"]', `${snapshot.paused ? '0.00' : snapshot.timeScale.toFixed(2)}×`);
    this.setText('[data-pause-label]', snapshot.paused ? 'RESUME TIME' : 'PAUSE TIME');

    this.setControlValue('mass', snapshot.mass);
    this.setControlValue('spin', snapshot.spin);
    this.setControlValue('diskHeat', snapshot.diskHeat);
    this.setControlValue('lensing', snapshot.lensing);
    this.setControlValue('timeScale', snapshot.timeScale);
    this.setControlValue('quality', snapshot.quality);

    for (const button of this.root.querySelectorAll<HTMLElement>('[data-camera-preset]')) {
      button.setAttribute('aria-pressed', String(button.dataset.cameraPreset === snapshot.cameraPreset));
    }
    this.root.classList.toggle('is-cockpit', snapshot.cameraPreset === 'cockpit');
    this.root.classList.toggle('ui-hidden', !snapshot.uiVisible);
  };

  private readonly handleInput = (event: Event): void => {
    const control = event.target as HTMLInputElement | HTMLSelectElement | null;
    const key = control?.dataset.control;
    if (!control || !key) return;

    if (key === 'quality' && qualityPresets.has(control.value as QualityPreset)) {
      this.store.patch({ quality: control.value as QualityPreset });
      return;
    }
    if (numericControls.has(key)) {
      this.store.patch({ [key]: Number(control.value) });
    }
  };

  private readonly handleClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('button') : null;
    if (!target) return;

    const cameraPreset = target.dataset.cameraPreset as CameraPreset | undefined;
    if (cameraPreset && cameraPresets.has(cameraPreset)) {
      this.store.patch({ cameraPreset });
      return;
    }

    switch (target.dataset.action) {
      case 'reset':
        this.store.reset();
        this.options.onReset?.();
        break;
      case 'hide':
        this.store.patch({ uiVisible: false });
        break;
      case 'pause':
        this.store.patch({ paused: !this.store.getSnapshot().paused });
        break;
      case 'collapse':
        this.collapsed = !this.collapsed;
        this.root?.querySelector('.science-deck')?.classList.toggle('is-collapsed', this.collapsed);
        target.setAttribute('aria-expanded', String(!this.collapsed));
        target.setAttribute('aria-label', this.collapsed ? 'Expand science deck' : 'Collapse science deck');
        break;
    }
  };

  private setText(selector: string, value: string): void {
    const element = this.root?.querySelector(selector);
    if (element) element.textContent = value;
  }

  private setControlValue(control: string, value: string | number): void {
    const element = this.root?.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[data-control="${control}"]`,
    );
    if (element && element.value !== String(value)) element.value = String(value);
  }
}
