import videojs from 'video.js';
const MenuItem = videojs.getComponent('MenuItem');
const Component = videojs.getComponent('Component');

/**
 * The QualityMenuItem component.
 */
export class QualityMenuItem extends MenuItem {

  /**
   * Instantiate the QualityMenuItem component.
   *
   * @param {Player} player the player instance
   * @param {Object} options options of the player
   */
  constructor(player, options) {
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

Component.registerComponent('QualityMenuItem', QualityMenuItem);
