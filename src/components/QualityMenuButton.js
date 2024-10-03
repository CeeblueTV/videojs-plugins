import videojs from 'video.js';
import { QualityMenuItem } from './QualityMenuItem';

// will be replaced on building by library version
const __libVersion__ = '?';

const MenuButton = videojs.getComponent('MenuButton');

/**
 * The QualityMenuButton component.
 */
export class QualityMenuButton extends MenuButton {

  /**
   * Instantiate the QualityMenuButton component.
   *
   * @param {Player} player Player object
   * @param {Object} options Player options
   */
  constructor(player, options) {
    super(player, options);
  }

  /**
   * Create the QualityMenuButton DOM element
   *
   * @return {Element} The new DOM element
   */
  createEl() {
    return videojs.dom.createEl('div', {
      className: 'vjs-http-source-selector vjs-menu-button vjs-menu-button-popup vjs-control vjs-button vjs-quality-button'
    });
  }

  /**
   * Update the menu based on the current state of its items.
   */
  update() {
    MenuButton.prototype.update.call(this);
  }

  /**
   * Main function for creating the menu items.
   *
   * @return {Array} the menu items created or undefined if there is no quality levels
   */
  createItems() {

    if (!this.options_.qualities.length) {
      return;
    }

    // If there are more than one quality enabled it means auto is selected
    let enableCount = 0;

    for (let j = 0; j < this.options_.qualities.length; j++) {
      if (this.options_.qualities[j].enabled) {
        enableCount++;
      }
    }

    // Create the auto button first
    const menuItems = [];
    const autoItem = new QualityMenuItem(this.player_, {
      label: 'AUTO',
      value: undefined,
      selected: enableCount > 1
    });

    autoItem.on('selected', (e, item) => {
      // Enable all qualities
      for (let j = 0; j < this.options_.qualities.length; j++) {
        const quality = this.options_.qualities[j];

        quality.enabled = true;
      }
      this.update();
    });
    menuItems.push(autoItem);

    // Create all qualities buttons
    for (let i = 0; i < this.options_.qualities.length; i++) {
      const quality = this.options_.qualities[i];
      const isSelected = i === this.options_.qualities.selectedIndex;
      const trackItem = new QualityMenuItem(this.player_, {
        label: quality.height + 'p' + ((enableCount > 1 && isSelected) ? ' ✓' : ''),
        value: quality.id,
        // Note: with VHS quality.enable can be false even if it is the selected quality
        selected: enableCount < 2 && isSelected,
        track: quality
      });

      trackItem.on('selected', (e, item) => {
        // We are forcing a quality, disable all other qualities if they are enabled
        for (let j = 0; j < this.options_.qualities.length; j++) {
          const qualityLevel = this.options_.qualities[j];

          if (item.options_.value === qualityLevel.id) {
            qualityLevel.enabled = true;
          } else if (qualityLevel.enabled) {
            qualityLevel.enabled = false;
          }
        }
        this.update();
      });
      menuItems.push(trackItem);
    }

    return menuItems;
  }

  /**
   * Handle click on the menu button
   */
  handleClick() {
    if (this.buttonPressed_) {
      this.unpressButton();
    } else {
      this.pressButton();
    }
  }
}

/**
 * Initialization function for the qualityButton plugin.
 * Sets up the qualityButton and options.
 *
 * @param {Player} player Player object.
 * @param {Object} options Plugin options object.
 * @return {boolean} true if the button was added, false otherwise
 */
export function setupQualityButton(player, options) {
  if (player.options().qualityButton === false) {
    videojs.log('Quality button is disabled');
    return;
  }

  // Wait for player to be ready
  if (player.readyState() < 1) {
    player.one('loadedmetadata', () => {
      setupQualityButton(player, options);
    });
    return;
  }
  videojs.registerComponent('VideoTrackMenuButton', QualityMenuButton);
  const qualityLevels = player.qualityLevels();

  // Create the quality button
  const controlBar = player.controlBar;

  // Removes a possible previous button
  controlBar.removeChild(player.videoMenu);
  player.videoMenu = new QualityMenuButton(player, {
    qualities: qualityLevels,
    buttonClass: 'vjs-video-button'
  });
  controlBar.el().insertBefore(controlBar.addChild(player.videoMenu).el(), controlBar.getChild('audioTrackButton').el());

  /**
   * Update the button when quality levels update
   **/
  function onQualityChange() {
    player.videoMenu.update();
  }

  qualityLevels.on('change', onQualityChange);

  /**
   * Disposes the quality button plugin.
   */
  function disposeHandler() {
    if (player.videoMenu) {
      player.videoMenu.dispose();
      player.controlBar.removeChild(player.videoMenu);
      qualityLevels.off('change', onQualityChange);
    }
    player.off('dispose', disposeHandler);
  }

  player.on('dispose', disposeHandler);

  player.qualityButton = () => player.videoMenu;
  player.qualityButton.VERSION = __libVersion__;

  return player.videoMenu;
}
