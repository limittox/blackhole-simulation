import './styles.css';
import { BlackHoleApp } from './app/BlackHoleApp';

const canvas = document.querySelector<HTMLCanvasElement>('#black-hole-canvas');
const interfaceRoot = document.querySelector<HTMLElement>('#interface-root');
const loadingScreen = document.querySelector<HTMLElement>('#loading-screen');

if (!canvas || !interfaceRoot || !loadingScreen) {
  throw new Error('The black hole application shell is incomplete.');
}

const app = new BlackHoleApp({ canvas, interfaceRoot, loadingScreen });
app.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.dispose());
}
