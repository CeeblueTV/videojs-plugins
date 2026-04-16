import videojs from 'video.js';
import { utils as webrtcUtils } from '@ceeblue/webrtc-client';
import { utils as wrtsUtils } from '@ceeblue/wrts-client';

type CeeblueLogLevel = webrtcUtils.LogLevel | wrtsUtils.LogLevel;

const LOG_PRIORITIES: Record<string, number> = {
  off: -1,
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  all: 3
};

function currentVideojsLogPriority() {
  return LOG_PRIORITIES[videojs.log.level()] ?? LOG_PRIORITIES.info;
}

function shouldForwardToVideojs(level: CeeblueLogLevel) {
  return (LOG_PRIORITIES[level] ?? LOG_PRIORITIES.info) <= currentVideojsLogPriority();
}

function forwardToVideojs(level: CeeblueLogLevel, args: unknown[], prefix: string) {
  if (shouldForwardToVideojs(level)) {
    switch (level) {
    case webrtcUtils.LogLevel.ERROR:
      videojs.log.error(prefix, ...args);
      break;
    case webrtcUtils.LogLevel.WARN:
      videojs.log.warn(prefix, ...args);
      break;
    case webrtcUtils.LogLevel.INFO:
      videojs.log(prefix, ...args);
      break;
    case webrtcUtils.LogLevel.DEBUG:
      videojs.log.debug(prefix, ...args);
      break;
    }
  }

  // Avoid a duplicate log in the console.
  args.length = 0;
}

export function configureCeeblueLogging() {
  // Let the Ceeblue clients emit all logs, then filter against the current Video.js level.
  webrtcUtils.log.level = true;
  wrtsUtils.log.level = true;

  wrtsUtils.log.on = (level: wrtsUtils.LogLevel, args: unknown[]) => {
    forwardToVideojs(level, args, 'WRTS');
  };

  webrtcUtils.log.on = (level: webrtcUtils.LogLevel, args: unknown[]) => {
    forwardToVideojs(level, args, 'WebRTC');
  };
}
