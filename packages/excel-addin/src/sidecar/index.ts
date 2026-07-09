/**
 * Sidecar entry point.
 *
 * Usage: node index.js [--config <path/to/config.json>]
 *
 * Serves the task-pane assets over HTTPS on 127.0.0.1 and bridges the pane
 * to the moli-code agent. Exits 0 if another healthy sidecar instance is
 * already listening on the configured port.
 */

import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadConfig, sidecarRoot, type SidecarConfig } from './config.js';
import { createHttpsServer } from './https-server.js';
import { attachWsServer } from './ws-server.js';
import { Logger } from './logger.js';

const VERSION = '0.4.0';

function parseArgs(argv: string[]): {
  configPath?: string;
  dev: boolean;
  insecureHttp: boolean;
} {
  let configPath: string | undefined;
  let dev = false;
  let insecureHttp = false;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--config' && argv[i + 1]) {
      configPath = argv[++i];
    } else if (argv[i] === '--dev') {
      dev = true;
    } else if (argv[i] === '--insecure-http') {
      insecureHttp = true;
    }
  }
  return { configPath, dev, insecureHttp: insecureHttp && dev };
}

function probeExistingInstance(
  port: number,
): Promise<'sidecar' | 'other' | 'free'> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: '127.0.0.1',
        port,
        path: '/health',
        method: 'GET',
        timeout: 3_000,
        rejectUnauthorized: false,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body) as { name?: string };
            resolve(parsed.name === 'moli-excel-sidecar' ? 'sidecar' : 'other');
          } catch {
            resolve('other');
          }
        });
      },
    );
    req.on('error', () => resolve('free'));
    req.on('timeout', () => {
      req.destroy();
      resolve('other');
    });
    req.end();
  });
}

async function main(): Promise<void> {
  const { configPath, dev, insecureHttp } = parseArgs(process.argv);
  const root = sidecarRoot();
  const resolvedConfigPath = configPath ?? path.join(root, 'config.json');
  const config: SidecarConfig = loadConfig(resolvedConfigPath);
  const configDir = path.dirname(resolvedConfigPath);

  const logger = new Logger({
    filePath: path.join(configDir, 'logs', 'sidecar.log'),
    minLevel: config.logLevel,
    mirrorToConsole: dev,
  });

  logger.info(
    `moli-excel-sidecar v${VERSION} starting (config=${resolvedConfigPath})`,
  );

  const existing = await probeExistingInstance(config.port);
  if (existing === 'sidecar') {
    logger.info(`Another sidecar already serves port ${config.port}; exiting.`);
    process.exit(0);
  }
  if (existing === 'other') {
    logger.error(
      `포트 ${config.port}를 다른 프로그램이 사용 중입니다. config.json의 port를 바꾸고 install.ps1 -Port 로 다시 설치하세요.`,
    );
    process.exit(1);
  }

  const hasPfx = fs.existsSync(config.certPfxPath);
  const hasPem =
    !!config.certPemCertPath &&
    !!config.certPemKeyPath &&
    fs.existsSync(config.certPemCertPath) &&
    fs.existsSync(config.certPemKeyPath);
  if (!hasPfx && !hasPem && !insecureHttp) {
    logger.error(
      `인증서 파일이 없습니다: ${config.certPfxPath}. install.ps1을 다시 실행해 주세요.`,
    );
    process.exit(1);
  }

  const webRoot = path.resolve(root, 'web');
  if (!fs.existsSync(path.join(webRoot, 'taskpane.html'))) {
    logger.error(`웹 자산을 찾을 수 없습니다: ${webRoot}`);
    process.exit(1);
  }

  const authToken = randomUUID();
  const server = createHttpsServer({
    port: config.port,
    webRoot,
    pfxPath: hasPfx ? config.certPfxPath : undefined,
    passphrase: config.certPassphrase,
    pemCertPath: config.certPemCertPath,
    pemKeyPath: config.certPemKeyPath,
    authToken,
    version: VERSION,
    logger,
    insecureHttp,
  });

  attachWsServer(
    server,
    authToken,
    { port: config.port, version: VERSION, config },
    logger,
  );

  const scheme = insecureHttp ? 'http' : 'https';
  server.listen(config.port, '127.0.0.1', () => {
    logger.info(
      `Listening on ${scheme}://localhost:${config.port} (webRoot=${webRoot})`,
    );
    if (dev) {
      // eslint-disable-next-line no-console
      console.log(
        `\n  작업창: ${scheme}://localhost:${config.port}/taskpane.html?mock=1\n`,
      );
    }
  });

  server.on('error', (err) => {
    logger.error('HTTPS server error', err);
    process.exit(1);
  });

  const shutdown = (): void => {
    logger.info('Shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('sidecar fatal:', err);
  process.exit(1);
});
