import { WorldViewer } from './WorldViewer';
import { AppControls } from './AppControls';
import { AppControlsModel } from './AppControlsModel';
import { html } from './html';

export class MainPage {
  private worldViewer: WorldViewer;
  private appControls: AppControls;
  private model: AppControlsModel;

  constructor() {
    this.model = new AppControlsModel();
    this.worldViewer = new WorldViewer();
    this.appControls = new AppControls(this.model);
  }

  render(): HTMLElement {
    const shell = html`<div class="app-shell"></div>`;
    shell.appendChild(this.worldViewer.render());
    shell.appendChild(this.appControls.render());
    return shell;
  }
}
