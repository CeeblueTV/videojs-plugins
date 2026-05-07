import videojs from 'video.js';
import type ComponentType from 'video.js/dist/types/component';
import type Player from 'video.js/dist/types/player';
import type MenuItemType from 'video.js/dist/types/menu/menu-item';

const MenuItem = videojs.getComponent('MenuItem') as unknown as typeof MenuItemType;
const Component = videojs.getComponent('Component');

export type SourceMenuItemOptions = {
  label: string;
  value: string;
  selected: boolean;
  selectable?: boolean;
  multiSelectable?: boolean;
  children?: unknown[];
  className?: string;
};

/**
 * The SourceMenuItem component.
 */
export class SourceMenuItem extends MenuItem {
  /**
   * The selected protocol value or "auto".
   */
  get value(): string {
    return this.options_.value;
  }

  /**
   * Instantiate the SourceMenuItem component.
   *
   * @param player the player instance
   * @param options options of the player
   */
  constructor(player: Player, options: SourceMenuItemOptions) {
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

Component.registerComponent('SourceMenuItem', SourceMenuItem as unknown as ComponentType);
