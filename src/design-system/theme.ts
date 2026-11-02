export type ThemeMode = 'light' | 'dark' | 'system';
type EffectiveMode = Exclude<ThemeMode, 'system'>;

/** Each surface owns its theme. Nothing is written onto the Obsidian body. */
export class ThemeController {
  private roots = new Set<HTMLElement>();
  private mode: ThemeMode = 'system';
  private media = window.matchMedia('(prefers-color-scheme: dark)');
  private observer: MutationObserver;
  private refresh = (): void => {
    const effective = this.effectiveMode;
    for (const root of this.roots) root.dataset.ffMode = effective;
  };

  constructor() {
    this.observer = new MutationObserver(this.refresh);
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    this.media.addEventListener('change', this.refresh);
  }

  get effectiveMode(): EffectiveMode {
    if (this.mode !== 'system') return this.mode;
    if (document.body.classList.contains('theme-dark')) return 'dark';
    if (document.body.classList.contains('theme-light')) return 'light';
    return this.media.matches ? 'dark' : 'light';
  }

  setMode(mode: ThemeMode): void { this.mode = mode; this.refresh(); }

  attach(root: HTMLElement): () => void {
    root.classList.add('ff-ui');
    root.dataset.ffPalette = 'palette-1';
    this.roots.add(root);
    this.refresh();
    return () => {
      this.roots.delete(root);
      root.classList.remove('ff-ui');
      delete root.dataset.ffMode;
      delete root.dataset.ffPalette;
    };
  }

  destroy(): void {
    this.observer.disconnect();
    this.media.removeEventListener('change', this.refresh);
    for (const root of this.roots) {
      root.classList.remove('ff-ui');
      delete root.dataset.ffMode;
      delete root.dataset.ffPalette;
    }
    this.roots.clear();
  }
}

const themes = new WeakMap<object, ThemeController>();
export function registerTheme(app: object, theme: ThemeController): void { themes.set(app, theme); }
export function attachTheme(app: object, root: HTMLElement): () => void {
  const theme = themes.get(app);
  if (!theme) throw new Error('非凡 UI 主题尚未初始化');
  return theme.attach(root);
}
export function unregisterTheme(app: object): void { themes.delete(app); }
