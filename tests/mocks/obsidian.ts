export class Notice {
  static messages: string[] = [];
  constructor(message: string) { Notice.messages.push(message); }
}
export class Plugin {}
export class App {}
export class ItemView {
  app: any;
  containerEl: HTMLElement;
  constructor(leaf: any) {
    this.app = leaf.app;
    this.containerEl = document.createElement('div');
    this.containerEl.append(document.createElement('div'),document.createElement('div'));
  }
}
export class WorkspaceLeaf {}
export class TFile {
  extension: string;
  basename: string;
  constructor(public path: string) {
    const name = path.split('/').pop()!;
    this.extension = name.split('.').pop()!;
    this.basename = name.slice(0, -(this.extension.length + 1));
  }
}
export class TFolder {}
export class Menu {}
export class Scope { register() {} }
export class Modal {
  scope = new Scope();
  containerEl = document.createElement('div');
  modalEl = this.containerEl;
  titleEl = document.createElement('h2');
  contentEl = document.createElement('div');
  constructor(public app: unknown) { this.containerEl.append(this.titleEl, this.contentEl); }
  setTitle(value: string) { this.titleEl.textContent = value; }
  open() {}
  close() {}
}
export class PluginSettingTab {
  containerEl = document.createElement('div');
  constructor(public app: unknown, public plugin: unknown) {}
}
export function setIcon(element: HTMLElement, name: string) { element.dataset.icon = name; }

class TextControl {
  inputEl = document.createElement('input');
  constructor(parent: HTMLElement) { parent.appendChild(this.inputEl); }
  setValue(value: string) { this.inputEl.value = value; return this; }
  setPlaceholder(value: string) { this.inputEl.placeholder = value; return this; }
  onChange(handler: (value: string) => void) {
    this.inputEl.addEventListener('input', () => handler(this.inputEl.value)); return this;
  }
}
class ButtonControl {
  buttonEl = document.createElement('button');
  constructor(parent: HTMLElement) { parent.appendChild(this.buttonEl); }
  setButtonText(value: string) { this.buttonEl.textContent = value; return this; }
  setCta() { return this; }
  setDisabled(value: boolean) { this.buttonEl.disabled = value; return this; }
  onClick(handler: () => void) { this.buttonEl.addEventListener('click', handler); return this; }
}
class DropdownControl {
  selectEl = document.createElement('select');
  constructor(parent: HTMLElement) { parent.appendChild(this.selectEl); }
  addOptions(values: Record<string, string>) {
    for (const [value, label] of Object.entries(values)) {
      const option = document.createElement('option'); option.value = value; option.textContent = label;
      this.selectEl.appendChild(option);
    }
    return this;
  }
  setValue(value: string) { this.selectEl.value = value; return this; }
  onChange(handler: (value: string) => void) { this.selectEl.addEventListener('change', () => handler(this.selectEl.value)); return this; }
}
class ToggleControl {
  toggleEl = document.createElement('input');
  constructor(parent: HTMLElement) { this.toggleEl.type = 'checkbox'; parent.appendChild(this.toggleEl); }
  setValue(value: boolean) { this.toggleEl.checked = value; return this; }
  onChange(handler: (value: boolean) => void) { this.toggleEl.addEventListener('change', () => handler(this.toggleEl.checked)); return this; }
}
class SliderControl {
  sliderEl = document.createElement('input');
  constructor(parent: HTMLElement) { this.sliderEl.type = 'range'; parent.appendChild(this.sliderEl); }
  setLimits(min: number, max: number, step: number) { this.sliderEl.min=String(min); this.sliderEl.max=String(max); this.sliderEl.step=String(step); return this; }
  setValue(value: number) { this.sliderEl.value = String(value); return this; }
  setDynamicTooltip() { return this; }
  onChange(handler: (value: number) => void) { this.sliderEl.addEventListener('input', () => handler(Number(this.sliderEl.value))); return this; }
}
export class Setting {
  settingEl: HTMLElement;
  controlEl: HTMLElement;
  nameEl: HTMLElement;
  constructor(parent: HTMLElement) {
    this.settingEl = document.createElement('div'); this.settingEl.className='setting-item';
    this.nameEl=document.createElement('div'); this.nameEl.className='setting-item-info';
    this.controlEl=document.createElement('div'); this.controlEl.className='setting-item-control';
    this.settingEl.append(this.nameEl,this.controlEl); parent.appendChild(this.settingEl);
  }
  setName(value: string) { this.nameEl.textContent=value; return this; }
  addText(callback: (control: TextControl) => void) { callback(new TextControl(this.controlEl)); return this; }
  addButton(callback: (control: ButtonControl) => void) { callback(new ButtonControl(this.controlEl)); return this; }
  addDropdown(callback: (control: DropdownControl) => void) { callback(new DropdownControl(this.controlEl)); return this; }
  addToggle(callback: (control: ToggleControl) => void) { callback(new ToggleControl(this.controlEl)); return this; }
  addSlider(callback: (control: SliderControl) => void) { callback(new SliderControl(this.controlEl)); return this; }
}
