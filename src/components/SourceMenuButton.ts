import videojs from 'video.js';
import type MenuButtonType from 'video.js/dist/types/menu/menu-button';
import type Player from 'video.js/dist/types/player';
import type ComponentType from 'video.js/dist/types/component';
import type { Event } from 'video.js/dist/types/event-target';
import { SourceMenuItem, type SourceMenuItemOptions } from './SourceMenuItem';
import type { CeeblueVideoJSPlugin } from '../ceeblue';

const MenuButton = videojs.getComponent('MenuButton') as unknown as typeof MenuButtonType;

const protocolLabels: Record<string, string> = {
  auto: 'AUTO',
  wrts: 'WRTS',
  webrtc: 'WebRTC',
  llhls: 'LL-HLS',
  hls: 'HLS',
  dash: 'DASH'
};

export type SourceMenuButtonOptions = {
  title: string;
  plugin: CeeblueVideoJSPlugin;
  children?: unknown[];
  className?: string;
};

function formatProtocolLabel(protocol?: string | null): string {
  if (!protocol) {
    return 'SOURCE';
  }

  return protocolLabels[protocol] || protocol.toUpperCase();
}

/**
 * The SourceMenuButton component.
 */
export class SourceMenuButton extends MenuButton {
  /**
   * SourceMenuButton component options.
   */
  options_: SourceMenuButtonOptions;
  private labelEl_: HTMLElement | null = null;

  /**
   * Instantiate the SourceMenuButton component.
   *
   * @param player Player object
   * @param options Player options
   */
  constructor(player: Player, options: SourceMenuButtonOptions) {
    super(player, options);
    this.controlText('Playback source');
    this.options_ = options;
    this.labelEl_ = videojs.dom.createEl('span', {
      className: 'vjs-source-button-label'
    });

    const menuButtonEl = this.menuButton_.el();
    const controlTextEl = menuButtonEl.querySelector('.vjs-control-text');

    if (controlTextEl) {
      menuButtonEl.insertBefore(this.labelEl_, controlTextEl);
    } else {
      menuButtonEl.appendChild(this.labelEl_);
    }

    this._updateLabel();
  }

  /**
   * Builds the default DOM className for this object.
   */
  buildCSSClass() {
    return `vjs-source-button ${super.buildCSSClass()}`;
  }

  /**
   * Allow sub components to stack CSS class names for the wrapper element.
   */
  buildWrapperCSSClass() {
    return `vjs-source-button ${super.buildWrapperCSSClass()}`;
  }

  /**
   * Main function for creating the menu items.
   *
   * @return the menu items created
   */
  createItems() {
    const menuItems = [];
    const currentProtocol = this.options_.plugin.currentSource?.sourceType;
    const isAutoFallbackEnabled = this.options_.plugin.isAutoFallbackEnabled;

    menuItems.push(this._createMenuItem({
      label: formatProtocolLabel('auto'),
      value: 'auto',
      selected: isAutoFallbackEnabled
    }));

    for (const protocol of this.options_.plugin.availableProtocols) {
      menuItems.push(this._createMenuItem({
        label: formatProtocolLabel(protocol),
        value: protocol,
        selected: !isAutoFallbackEnabled && protocol === currentProtocol
      }));
    }

    return menuItems;
  }

  /**
   * Keep the main button label aligned with the active protocol.
   */
  update() {
    super.update();
    this._updateLabel();
  }

  /**
   * Handle source menu item click.
   */
  private _handleMenuItemClick(_: Event, menuItem: SourceMenuItem) {
    if (menuItem.value === 'auto') {
      this.options_.plugin.setAutoFallback(true);
      this.update();
      return;
    }

    this.options_.plugin.setSource({ protocol: menuItem.value });
    this._updateLabel();
  }

  /**
   * Create and initialize a menu item.
   */
  private _createMenuItem(options: SourceMenuItemOptions) {
    const item = new SourceMenuItem(this.player_, options);

    item.addClass('vjs-ceeblue-source-button');
    item.on('selected', this._handleMenuItemClick.bind(this));

    return item;
  }

  /**
   * Update the visible protocol label.
   */
  private _updateLabel() {
    if (!this.labelEl_) {
      return;
    }

    this.labelEl_.textContent = formatProtocolLabel(this.options_.plugin.currentSource?.sourceType);
  }

  /**
   * Handle click on the menu button
   */
  handleClick() {
    // @ts-expect-error - buttonPressed_ is private
    if (this.buttonPressed_) {
      this.unpressButton();
    } else {
      this.pressButton();
    }
  }

  override dispose() {
    this.labelEl_ = null;
    super.dispose();
  }
}

videojs.registerComponent('SourceMenuButton', SourceMenuButton as unknown as ComponentType);
