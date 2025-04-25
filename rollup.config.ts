/**
 * Ceeblue plugins rollup config
 *
 * This is a fork of the videojs-generate-rollup-config plugin with ceeblue Rollup config.
 * But with some changes to make it work with rollup v4 and typescript.
 **/

import path from 'path';
import videojs from 'video.js';
import type { RollupOptions, Plugin } from 'rollup';
import { fileURLToPath } from 'url';

// Core plugins
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import { babel } from '@rollup/plugin-babel';
import multi from '@rollup/plugin-multi-entry';
import externalGlobals from 'rollup-plugin-external-globals';
//@ts-expect-error - no types
import istanbul from 'rollup-plugin-istanbul';
import terser from '@rollup/plugin-terser';
import pkg from './package.json' with { type: 'json' };

type BuildKind = 'browser' | 'module' | 'test';
type PluginName =
  | 'resolve' | 'commonjs' | 'json' | 'replace'
  | 'babel' | 'multiEntry' | 'externalGlobals'
  | 'istanbul' | 'uglify';

type PluginMap = Record<BuildKind, (PluginName | Plugin)[]>;
interface PrimedMap { [key: string]: Plugin; }

/** * Simple semver regex taken from semver.org */
const semverRX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const isSemver = (v: string) => semverRX.test(v);

// ---------------------------------------------------------------------------
// Mini‑clone of videojs‑generate‑rollup‑config (trimmed for clarity)
// ---------------------------------------------------------------------------
function buildSettings() {
  const baseName = pkg.name.replace(/^@.*\//, '');
  const exportName = baseName.replace(/-(\w)/g, (_m: string, l: string) => l.toUpperCase());
  const basedir = path.dirname(fileURLToPath(import.meta.url));

  const settings = {
    input: 'src/plugin.ts',
    testInput: 'test/**/*.test.{js,ts,tsx}',
    distName: baseName,
    exportName,
    banner: `/*! @name ${pkg.name} @version ${pkg.version} @license ${pkg.license} */`,
    //@ts-expect-error - we don't have browserslist in package.json yet.
    browserslist: pkg.browserslist || ['defaults', 'ie 11'],
    excludeCoverage: ['test/**', path.join(basedir, '**'), 'node_modules/**', 'package.json', /^data-files!/],

    // plugin name lists (can be customised later)
    plugins: {
      browser: ['replace', 'resolve', 'json', 'commonjs', 'externalGlobals', 'babel'],
      module: ['replace', 'resolve', 'json', 'commonjs', 'babel'],
      test: ['multiEntry', 'replace', 'resolve', 'json', 'commonjs', 'externalGlobals', 'istanbul', 'babel']
    } as PluginMap,

    // primed plugin instances (can be overridden later)
    primedPlugins: {} as PrimedMap,

    // externals & globals for each bundle type
    globals: {
      browser: { 'video.js': 'videojs' },
      module: { 'video.js': 'videojs' },
      test: { 'video.js': 'videojs', qunit: 'QUnit', qunitjs: 'QUnit', sinon: 'sinon' }
    } as Record<BuildKind, Record<string, string>>,

    externals: {
      browser: ['video.js'] as string[],
      module: ['global', '@babel/runtime', 'video.js'] as string[],
      test: ['video.js'] as string[]
    }
  };

  settings.primedPlugins.resolve = nodeResolve({ browser: true, extensions: ['.js', '.ts', '.json'] });
  settings.primedPlugins.commonjs = commonjs({ sourceMap: false });
  settings.primedPlugins.json = json();
  settings.primedPlugins.multiEntry = multi({ exports: false });
  settings.primedPlugins.babel = babel({
    babelHelpers: 'bundled',
    extensions: ['.js', '.ts', '.tsx'],
    exclude: 'node_modules/**',
    presets: [
      ['@babel/preset-env', { loose: true, modules: false, targets: { browsers: settings.browserslist } }],
      ['@babel/preset-typescript', { jsxPragma: 'React' }]
    ]
  }) as Plugin;
  settings.primedPlugins.replace = replace({ preventAssignment: true, __libVersion__: JSON.stringify(pkg.version) });
  settings.primedPlugins.externalGlobals = externalGlobals({ global: 'window', 'global/window': 'window', 'global/document': 'document' });
  settings.primedPlugins.istanbul = istanbul({ exclude: settings.excludeCoverage });
  settings.primedPlugins.uglify = terser({ output: { comments: 'some' } });

  return settings;
}

// ---------------------------------------------------------------------------
// Build factory (browser, module, test)
// ---------------------------------------------------------------------------

function makeBuild(kind: BuildKind, s: ReturnType<typeof buildSettings>): RollupOptions {
  const mapPlugins = (names: (PluginName | Plugin)[]) =>
    names.map((p) => typeof p === 'string' ? s.primedPlugins[p] : p);

  const base: RollupOptions = {
    watch: { clearScreen: false },
    input: kind === 'test' ? s.testInput : s.input,
    plugins: mapPlugins(s.plugins[kind]),
    external: (id) => s.externals[kind].some((ext) => id.startsWith(ext))
  };

  if (kind === 'browser') {
    base.output = [
      {
        name: s.exportName,
        file: `dist/${s.distName}.js`,
        format: 'umd',
        banner: s.banner,
        globals: s.globals.browser
      },
      {
        name: s.exportName,
        file: `dist/${s.distName}.min.js`,
        format: 'umd',
        banner: s.banner,
        globals: s.globals.browser,
        plugins: [s.primedPlugins.uglify]
      }
    ];
  } else if (kind === 'module') {
    base.output = [
      { file: `dist/${s.distName}.es.js`, format: 'es', exports: 'auto', banner: s.banner }
    ];
  } else {
    base.output = {
      name: `${s.exportName}Tests`,
      file: 'test/dist/bundle.js',
      format: 'iife',
      banner: s.banner,
      globals: s.globals.test
    };
  }

  return base;
}

export default (): RollupOptions[] => {
  const version = process.env.version ?? process.env.npm_package_version;

  if (typeof version !== 'string' || !isSemver(version)) {
    throw new Error('✖ Version missing or not SemVer – set CI env var `version` or fix package.json');
  }
  videojs.log(`Building version: ${version}`);

  const s = buildSettings();

  Object.values(s.primedPlugins).forEach((p) => {
    if ((p as any).name === 'replace') {
      // @ts-expect-error - plugin version
      p.__libVersion__ = JSON.stringify(version);
    }
  });

  const builds: Record<string, RollupOptions> = {
    browser: makeBuild('browser', s),
    module: makeBuild('module', s),
    test: makeBuild('test', s)
  };

  if (process.env.TEST_BUNDLE_ONLY) {
    delete builds.browser;
    delete builds.module;
  } else if (process.env.NO_TEST_BUNDLE) {
    delete builds.test;
  }

  return Object.values(builds);
};
