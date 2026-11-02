/**
 * Theme management for PanzerNavSystem (Dark / Light with persistence)
 */

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'panzer_nav_theme';

export class ThemeManager {
  private currentTheme: Theme;
  private onChangeCallbacks: ((theme: Theme) => void)[] = [];

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'dark' || saved === 'light') {
      this.currentTheme = saved;
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.currentTheme = prefersDark ? 'dark' : 'light';
    }

    this.applyTheme(this.currentTheme);

    // Listen for OS theme changes if user has not explicitly chosen
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        this.setTheme(e.matches ? 'dark' : 'light', false);
      }
    });
  }

  public getTheme(): Theme {
    return this.currentTheme;
  }

  public toggleTheme(): Theme {
    const next = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(next, true);
    return next;
  }

  public setTheme(theme: Theme, persist: boolean = true): void {
    this.currentTheme = theme;
    if (persist) {
      localStorage.setItem(STORAGE_KEY, theme);
    }
    this.applyTheme(theme);
    for (const cb of this.onChangeCallbacks) {
      cb(theme);
    }
  }

  public onThemeChange(cb: (theme: Theme) => void): void {
    this.onChangeCallbacks.push(cb);
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0d1117' : '#f4f6f9');
    }
  }
}
