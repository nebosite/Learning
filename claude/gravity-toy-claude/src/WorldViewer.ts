import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { html } from './html';

export class WorldViewer {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private viewport!: HTMLElement;

  render(): HTMLElement {
    const section = html`
      <section class="viewport">
        <canvas></canvas>
      </section>
    `;
    const canvas = section.querySelector('canvas') as HTMLCanvasElement;

    this.viewport = section;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(devicePixelRatio);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1e6);
    this.camera.position.set(0, 30, 80);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const sunLight = new THREE.PointLight(0xfffbe0, 2, 0, 2);
    this.scene.add(sunLight);

    const starGeo = new THREE.SphereGeometry(3, 32, 32);
    const starMat = new THREE.MeshStandardMaterial({ color: 0xffee88, emissive: 0xffaa00, emissiveIntensity: 1 });
    this.scene.add(new THREE.Mesh(starGeo, starMat));

    new ResizeObserver(() => this.resize()).observe(section);
    this.resize();
    this.animate();

    return section;
  }

  private resize(): void {
    const w = this.viewport.clientWidth;
    const h = this.viewport.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
