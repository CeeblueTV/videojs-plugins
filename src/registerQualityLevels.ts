import videojs from 'video.js';
import QualityLevelList from 'videojs-contrib-quality-levels/src/quality-level-list.js';
import qualityLevelsPackage from 'videojs-contrib-quality-levels/package.json' with { type: 'json' };

const qualityLevelsPlugin = videojs.getPlugin('qualityLevels');

if (!qualityLevelsPlugin) {
  const version = qualityLevelsPackage.version;

  const qualityLevels = function() {
    const player = this as videojs.Player & {
      qualityLevels?: (() => InstanceType<typeof QualityLevelList>) & { VERSION?: string };
    };
    const originalPluginFn = player.qualityLevels;
    const qualityLevelList = new QualityLevelList();

    const disposeHandler = function() {
      qualityLevelList.dispose();
      player.qualityLevels = originalPluginFn;
      player.off('dispose', disposeHandler);
    };

    player.on('dispose', disposeHandler);
    player.qualityLevels = () => qualityLevelList;
    player.qualityLevels.VERSION = version;

    return qualityLevelList;
  };

  videojs.registerPlugin('qualityLevels', qualityLevels);
  qualityLevels.VERSION = version;
}
