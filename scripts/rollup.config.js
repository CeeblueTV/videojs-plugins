const videojs = require('video.js');
const generate = require('videojs-generate-rollup-config');
const replace = require('@rollup/plugin-replace');

// see https://github.com/videojs/videojs-generate-rollup-config
// for options
// const options = {};
// const config = generate(options);

// Add additonal builds/customization here!

// export the builds to rollup
// export default Object.values(config.builds);

module.exports = function(context) {

  // Determine the package version by using the 'version' environment variable (for CI/CD processes) or fallback to the version specified in the 'package.json' file.
  const version = process.env.version ?? process.env.npm_package_version;

  // Validate the version format
  if (typeof version === 'string') {
    // https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
    const versionRegex =
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

    if (!versionRegex.test(version)) {
      throw new Error('The provided version string does not comply with the Semantic Versioning (SemVer) format required.' +
        ' Please refer to https://semver.org/ for more details on the SemVer specification.');
    }
    videojs.log('Building version: ' + version);
  } else {
    throw new Error('Version is undefined or not a string.');
  }

  const options = {
    plugins(defaults) {
      defaults.module.unshift('replace');
      defaults.browser.unshift('replace');
      return defaults;
    },
    primedPlugins(defaults) {
      // replace variable in the code, here used for versionning
      defaults.replace = replace({
        __libVersion__: "'" + version + "'",
        preventAssignment: true
      });
      return defaults;
    }
  };
  // const config = generate(options);
  const config = generate(options, context);

  // do custom stuff here
  return Object.values(config.builds);
};
