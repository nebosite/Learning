import { AppControlsModel } from './AppControlsModel';
import { html } from './html';

export class AppControls {
  private model: AppControlsModel;

  constructor(model: AppControlsModel) {
    this.model = model;
  }

  render(): HTMLElement {
    return html`<aside class="control-panel"></aside>`;
  }
}
