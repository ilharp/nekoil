import type { Context } from 'koishi'
import { Schema, Service } from 'koishi'
import { createClient, createCluster } from 'redis'

declare module 'koishi' {
  interface Context {
    redis: Redis
  }
}

export class Redis extends Service {
  #l

  public client: Redis.RedisClient = undefined as unknown as Redis.RedisClient

  constructor(ctx: Context, config: Redis.Config) {
    super(ctx, 'redis')

    this.#l = ctx.logger('redis')

    ctx.on('ready', async () => {
      // @ts-expect-error createCluster bad type
      this.client = await (
        config.mode === 'cluster'
          ? createCluster({
              rootNodes: config.rootNodes.map((url) => ({ url })),
              defaults: {
                readonly: config.readonly,
              },
            })
          : createClient({
              readonly: config.readonly,
              url: config.url,
            })
      )
        .on('ready', () => {
          this.#l.success(`connected`)
        })
        .on('error', this.#l.error)
        .connect()
    })

    ctx.on('dispose', async () => {
      await this.client.disconnect()
    })
  }
}

export namespace Redis {
  export type Config = (
    | {
        mode: 'client'
        url: string
      }
    | {
        mode: 'cluster'
        rootNodes: string[]
        useReplicas: boolean
      }
  ) & {
    disableOfflineQueue: boolean
    readonly: boolean
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      disableOfflineQueue: Schema.boolean()
        .description(
          'Disables offline queuing, see [FAQ](./FAQ.md#what-happens-when-the-network-goes-down)',
        )
        .default(false),
      readonly: Schema.boolean()
        .description(
          'Connect in [`READONLY`](https://redis.io/commands/readonly) mode',
        )
        .default(false),
      mode: Schema.union(['client', 'cluster']).required(),
    }),
    Schema.union([
      Schema.object({
        mode: Schema.const('client').required(),
        url: Schema.string()
          .description(
            '`redis[s]://[[username][:password]@][host][:port][/db-number]` (see [`redis`](https://www.iana.org/assignments/uri-schemes/prov/redis) and [`rediss`](https://www.iana.org/assignments/uri-schemes/prov/rediss) IANA registration for more details)',
          )
          .default('redis://127.0.0.1:6379/0'),
      }),
      Schema.object({
        mode: Schema.const('cluster').required(),
        rootNodes: Schema.array(String)
          .description(
            'An array of root nodes that are part of the cluster, which will be used to get the cluster topology.',
          )
          .role('table')
          .default(['redis://127.0.0.1:6379']),
        useReplicas: Schema.boolean()
          .description(
            'When `true`, distribute load by executing readonly commands (such as `GET`, `GEOSEARCH`, etc.) across all cluster nodes. When `false`, only use master nodes',
          )
          .default(false),
      }),
    ]),
  ])

  export type RedisClient = ReturnType<typeof createClient>
}
