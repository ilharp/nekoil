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

  constructor(
    ctx: Context,
    private redisConfig: Redis.Config,
  ) {
    super(ctx, 'redis')

    this.#l = ctx.logger('redis')

    ctx.on('ready', async () => {
      try {
        this.client = await this.#isolateIntl(true)
      } catch (_) {
        // Already logged
      }
    })

    ctx.on('dispose', async () => {
      this.client.destroy()
    })
  }

  public isolate = () => this.#isolateIntl(false)

  #isolateIntl = async (logConnect: boolean) => {
    try {
      const client = (
        this.redisConfig.mode === 'cluster'
          ? createCluster({
              rootNodes: this.redisConfig.rootNodes.map((url) => ({ url })),
              defaults: {
                readonly: this.redisConfig.readonly,
              },
            })
          : createClient({
              readonly: this.redisConfig.readonly,
              url: this.redisConfig.url,
            })
      ) as Redis.RedisClient

      if (logConnect) {
        client.on('connect', () => {
          this.#l.success('connecting')
        })
        client.on('ready', () => {
          this.#l.success('connected')
        })
      }

      client.on('error', this.#l.error)

      await client.connect()

      return client
    } catch (e) {
      this.#l.error(e)
      throw e
    }
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
      mode: Schema.union(['client', 'cluster']).default('client'),
    }),
    Schema.union([
      Schema.object({
        mode: Schema.const('client'),
        url: Schema.string()
          .description(
            '`redis[s]://[[username][:password]@][host][:port][/db-number]` (see [`redis`](https://www.iana.org/assignments/uri-schemes/prov/redis) and [`rediss`](https://www.iana.org/assignments/uri-schemes/prov/rediss) IANA registration for more details)',
          )
          .default('redis://127.0.0.1:6379/0'),
      }),
      Schema.object({
        mode: Schema.const('cluster'),
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
