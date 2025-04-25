declare module 'videojs-generate-rollup-config' {
  import type { RollupOptions } from 'rollup';

  interface GenerateOptions {
    plugins?: (defaults: string[]) => string[];
    primedPlugins?: (defaults: Record<string, any>) => Record<string, any>;
  }

  interface BuildConfig {
    builds: Record<string, RollupOptions>;
  }

  function generate(options: GenerateOptions, context?: { version?: string }): BuildConfig;

  export default generate;
}
