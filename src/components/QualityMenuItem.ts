import videojs from 'video.js';
import type ComponentType from 'video.js/dist/types/component';
import type Player from 'video.js/dist/types/player';
import type QualityLevel from 'videojs-contrib-quality-levels/dist/types/quality-level';
import type MenuItemType from 'video.js/dist/types/menu/menu-item';

const MenuItem = videojs.getComponent('MenuItem') as unknown as typeof MenuItemType;
const Component = videojs.getComponent('Component');

export type QualityMenuItemOptions = {
  label: string;
  value: string;
  selected: boolean;
  enabled?: boolean;
  quality?: QualityLevel;
  selectable?: boolean;
  multiSelectable?: boolean;
  children?: unknown[];
  className?: string;
};
/**
 * The QualityMenuItem component.
 */
export class QualityMenuItem extends MenuItem {
  /**
   * The current quality level.
   */
  get quality(): QualityLevel {
    return this.options_.quality;
  }

  /**
   * Instantiate the QualityMenuItem component.
   *
   * @param player the player instance
   * @param  options options of the player
   */
  constructor(player: Player, options: QualityMenuItemOptions) {
    options.selectable = true;
    options.multiSelectable = false;
    super(player, options);
  }

  /**
   * Handle click on the menu item, it will trigger a selected event
   */
  handleClick() {
    this.trigger('selected', this);
  }
}

Component.registerComponent('QualityMenuItem', QualityMenuItem as unknown as ComponentType);
