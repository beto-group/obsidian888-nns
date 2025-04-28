import { App, setIcon } from 'obsidian';
import { consoleCSS } from '../console/styles/consoleStyles';

/**
 * Interface for a tab in the TabComponent.
 */
export interface Tab {
  id: string;
  name: string;
  render(container: HTMLElement): void;
  cleanup(): void;
}

/**
 * Configuration for a tab, including its icon.
 */
export interface TabConfig {
  tab: Tab;
  icon: string;
}

/**
 * Reusable TabComponent for managing and rendering tabs.
 */
export class TabComponent {
  private activeTabId: string;
  private container: HTMLElement | null = null;
  private tabContentContainer: HTMLElement | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private onTabChange: (tabId: string) => void; // Callback for tab changes

  constructor(
    private app: App,
    private tabs: TabConfig[],
    initialTabId: string,
    onTabChange: (tabId: string) => void = () => {} // Default to no-op
  ) {
    this.activeTabId = tabs.some(t => t.tab.id === initialTabId) ? initialTabId : tabs[0]?.tab.id;
    this.onTabChange = onTabChange; // Store callback
  }

  /**
   * Renders the tab selector and content area into the provided container.
   */
  render(container: HTMLElement): void {
    this.container = container;

    // Inject CSS styles
    this.styleElement = document.createElement('style');
    this.styleElement.textContent = consoleCSS;
    document.head.appendChild(this.styleElement);

    // Create tab selector
    const tabSelector = this.container.createEl('div', { cls: 'ai-console-tab-selector' });

    // Render tab buttons
    this.tabs.forEach(({ tab, icon }) => {
      const isActive = tab.id === this.activeTabId;
      const tabButton = tabSelector.createEl('button', {
        cls: `ai-console-tab-button${isActive ? ' active' : ''}`,
      });
    
      // Use the icon from TabConfig
      const iconEl = tabButton.createEl('span', { cls: 'ai-console-tab-icon' });
      setIcon(iconEl, icon);
    
      // Add label with proper spacing
      tabButton.createSpan({ cls: 'ai-console-tab-label', text: tab.name.split(' ')[0] });
    
      // Handle click
      tabButton.addEventListener('click', () => this.switchTab(tab.id));
    });

    // Create content container
    this.tabContentContainer = this.container.createEl('div', { cls: 'ai-console-tab-content' });

    // Render initial active tab
    this.renderActiveTab();
  }

  /**
   * Switches to the specified tab and re-renders the content.
   */
  private switchTab(tabId: string): void {
    if (tabId === this.activeTabId) return;
    this.activeTabId = tabId;
    this.renderActiveTab();
    this.onTabChange(tabId); // Notify on tab change
  }

  /**
   * Renders the content of the active tab and updates button states.
   */
  private renderActiveTab(): void {
    if (!this.container || !this.tabContentContainer) return;

    // Update button states
    const buttons = this.container.querySelectorAll('.ai-console-tab-button');
    const activeTabName = this.tabs.find(t => t.tab.id === this.activeTabId)?.tab.name.split(' ')[0] || '';

    buttons.forEach(button => {
      const buttonLabel = button.querySelector('.ai-console-tab-label')?.textContent || '';
      const isActive = buttonLabel === activeTabName;
      button.classList.toggle('active', isActive);
    });

    // Clear and render active tab content
    this.tabContentContainer.empty();
    const activeTab = this.tabs.find(t => t.tab.id === this.activeTabId)?.tab;
    if (activeTab) {
      activeTab.render(this.tabContentContainer);
    }
  }

  /**
   * Cleans up the component, including styles and tab content.
   */
  cleanup(): void {
    this.tabs.forEach(({ tab }) => tab.cleanup());
    if (this.container) {
      this.container.empty();
    }
    if (this.styleElement && this.styleElement.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
    }
    this.container = null;
    this.tabContentContainer = null;
    this.styleElement = null;
  }

  /**
   * Gets the ID of the currently active tab.
   */
  getActiveTabId(): string {
    return this.activeTabId;
  }
}