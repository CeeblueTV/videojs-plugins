import videojs from 'video.js';
import { QualityMenuItem, type QualityMenuItemOptions } from './QualityMenuItem';
import type MenuButtonType from 'video.js/dist/types/menu/menu-button';
import type Player from 'video.js/dist/types/player';
import type QualityLevelList from 'videojs-contrib-quality-levels/dist/types/quality-level-list';
import type QualityLevel from 'videojs-contrib-quality-levels/dist/types/quality-level';
import type { Event } from 'video.js/dist/types/event-target';
import type ComponentType from 'video.js/dist/types/component';

const MenuButton = videojs.getComponent('MenuButton') as unknown as typeof MenuButtonType;

export type QualityMenuButtonOptions = {
  title: string;
  buttonClass: string;
  qualities: QualityLevelList;
  children?: unknown[];
  className?: string;
};

/**
 * The QualityMenuButton component.
 */
export class QualityMenuButton extends MenuButton {
  /**
   * QualityMenuButton component options.
   */
  options_: QualityMenuButtonOptions;
  private labelEl_: HTMLElement | null = null;

  /**
   * Keep a ref to the selected quality level.
   * This is used to update the selected quality level.
   */
  selectedQuality?: WeakRef<QualityLevel>;

  /**
   * Instantiate the QualityMenuButton component.
   *
   * @param player Player object
   * @param options Player options
   */
  constructor(player: Player, options: QualityMenuButtonOptions) {
    super(player, options);
    this.controlText('Video quality');

    options.qualities.on('change', this.update.bind(this));
    options.qualities.on('addqualitylevel', this.update.bind(this));
    options.qualities.on('removequalitylevel', this.update.bind(this));

    // This is probably not needed as it should get assigned by the parent class.
    // Just to be sure :)
    this.options_ = options;

    this.labelEl_ = videojs.dom.createEl('span', {
      className: 'vjs-quality-button-label'
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
   * Create the QualityMenuButton DOM element
   *
   * @return The new DOM element
   */
  createEl() {
    return videojs.dom.createEl('div', {
      className: 'vjs-menu-button vjs-menu-button-popup vjs-control vjs-quality-button'
    });
  }

  /**
   * Main function for creating the menu items.
   *
   * @return the menu items created or undefined if there is no quality levels
   */
  createItems() {
    const isAuto = this._isAutoSelected(this.options_.qualities);
    const menuItems = [];

    menuItems.push(this._createMenuItem({
      label: 'AUTO',
      value: 'auto',
      selected: isAuto
    }));

    // @ts-expect-error - QualityLevels is missing ArrayLike Type
    for (let i = 0; i < this.options_.qualities.length; i++) {
      // @ts-expect-error - QualityLevels is missing ArrayLike Type
      const quality = this.options_.qualities[i];
      const isCurrentQuality = i === this.options_.qualities.selectedIndex;

      const trackItem = this._createMenuItem({
        label: this._getQualityLabel(quality) + (isAuto && isCurrentQuality ? ' ✓' : ''),
        value: quality.id,
        // Note: with VHS quality.enable can be false even if it is the selected quality
        selected: !isAuto && quality.enabled,
        quality: quality
      });

      menuItems.push(trackItem);
    }

    return menuItems;
  }

  /**
   * Update the menu and the main button label.
   */
  update() {
    super.update();
    this._updateLabel();
  }

  /**
   * Handle qualities menu item click.
   */
  private _handleMenuItemClick(e: Event, menuItem: QualityMenuItem) {
    const isAuto = !menuItem.quality;

    this.selectedQuality = menuItem.quality ? new WeakRef(menuItem.quality) : void 0;

    // @ts-expect-error - QualityLevels is missing ArrayLike Type
    for (let i = 0; i < this.items.length; i++) {
      // @ts-expect-error - QualityLevels is missing ArrayLike Type
      const item = this.items[i] as QualityMenuItem;

      // Auto menu item.
      if (!item.quality) {
        continue;
      }

      // Enable all qualities if auto is selected.
      // Otherwise, enable only the selected quality.
      // @ts-expect-error - QualityLevel.enabled is missing from type.
      item.quality.enabled = isAuto || item === menuItem;
    }

    this.update();
  }

  /**
   * Create and initialize a menu item.
   */
  private _createMenuItem(options: QualityMenuItemOptions) {
    const item = new QualityMenuItem(this.player_, options);

    item.addClass('vjs-ceeblue-quality-button');
    item.on('selected', this._handleMenuItemClick.bind(this));

    return item;
  }

  /**
   * Detect if auto is selected.
   *
   */
  private _isAutoSelected(qualities: QualityLevelList): boolean {
    let multipleEnabled = 0;
    // @ts-expect-error - QualityLevels is missing ArrayLike Type

    for (let j = 0; j < qualities.length; j++) {
      // @ts-expect-errort - QualityLevels is missing ArrayLike Type
      const qualityLevel = qualities[j] as QualityLevel;

      // If there are more than one quality enabled it means auto is selected
      // @ts-expect-error - QualityLevel.enabled is missing from type.
      if (qualityLevel.enabled && ++multipleEnabled > 1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create a readable label for the provided quality level.
   */
  private _getQualityLabel(quality: QualityLevel): string {
    if (quality.label && quality.label !== quality.id) {
      return String(quality.label);
    }

    if (quality.height) {
      return quality.height + 'p';
    }

    if (quality.width && quality.height) {
      return quality.width + 'x' + quality.height;
    }

    return String(quality.id);
  }

  /**
   * Update the main button label to the currently active rendition.
   */
  private _updateLabel() {
    if (!this.labelEl_) {
      return;
    }

    const selectedIndex = this.options_.qualities.selectedIndex;
    const selectedQuality = selectedIndex >= 0
      // @ts-expect-error - QualityLevels is missing ArrayLike Type
      ? this.options_.qualities[selectedIndex] as QualityLevel | undefined
      : void 0;

    this.labelEl_.textContent = selectedQuality ? this._getQualityLabel(selectedQuality) : '';

    if (selectedQuality) {
      this.addClass('vjs-quality-button--has-label');
    } else {
      this.removeClass('vjs-quality-button--has-label');
    }
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

videojs.registerComponent('QualityMenuButton', QualityMenuButton as unknown as ComponentType);
