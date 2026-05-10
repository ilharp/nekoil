import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import * as opentelemetry from '@opentelemetry/sdk-node'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions'
import type { Context } from 'koishi'
import { env } from 'node:process'
import * as bind from './bind'
import type { Config } from './config'
import * as cp from './cp'
import * as niassets from './niassets'
import { NekoilPermissionService } from './services/perm'
import { NekoilTgService } from './services/tg'
import { UpusrService } from './services/upusr'
import { NekoilUserService } from './services/user'

export * from './config'

export const name = 'nekoil-core'

export const apply = (ctx: Context, config: Config) => {
  const sdk = new opentelemetry.NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'nekoil-core',
      [ATTR_SERVICE_VERSION]: '0.1.0',
    }),
    traceExporter: new OTLPTraceExporter({
      url: env['OTEL_EXPORTER_OTLP_ENDPOINT'],
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: env['OTEL_EXPORTER_OTLP_ENDPOINT'],
      }),
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  })

  sdk.start()

  ctx.on('dispose', () => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    sdk.shutdown()
  })

  ctx.plugin(UpusrService)
  ctx.plugin(NekoilUserService)
  ctx.plugin(NekoilPermissionService)
  ctx.plugin(NekoilTgService, config)
  ctx.plugin(cp, config)
  ctx.plugin(niassets, config)
  ctx.plugin(bind)
  // ctx.plugin(sch, config)

  ctx.on('before-send', (session) => {
    return ['onebot', 'milky'].includes(session.platform)
  })
}
