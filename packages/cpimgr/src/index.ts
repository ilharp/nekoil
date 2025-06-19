import type { CpimgrPayload } from 'nekoil-typedef'
import { Buffer } from 'node:buffer'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import { argv } from 'node:process'
import type { BoundingBox } from 'puppeteer-core'
import { launch } from 'puppeteer-core'
import find from 'puppeteer-finder'

const dev = argv.slice(1).includes('--dev')

const browser = await launch({
  executablePath: find() as string,
  headless: !dev,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: {
    deviceScaleFactor: 2,
    width: 800,
    height: dev ? 800 : 50,
  },
})

const controller = async (req: IncomingMessage, res: ServerResponse) => {
  if (!req.url) {
    console.log('[ctrl] 400 bad request')
    res.writeHead(400)
    res.end('400 bad request')
    return
  }

  const url = new URL(req.url, 'http://dummy')

  if (req.method !== 'POST') {
    console.log('[ctrl] 405 method not allowed')
    res.writeHead(405)
    res.end('405 method not allowed')
    return
  }

  const payload = JSON.parse(await req2String(req)) as CpimgrPayload

  const page = await browser.newPage()

  try {
    await page.setExtraHTTPHeaders({
      'Nekoil-Cpssr-Data': Buffer.from(
        JSON.stringify(payload.cpwfData),
      ).toString('base64'),
      'Nekoil-Proxy-Token': payload.proxyToken,
      'Nekoil-Internal-Token': payload.internalToken,
      'Nekoil-SelfUrl-Internal': payload.selfUrlInternal,
    })
    if (!dev) await page.setJavaScriptEnabled(false)
    await page.goto(payload.cpssrUrl)
    await page.waitForNetworkIdle()

    switch (url.pathname) {
      case '/render': {
        const body = (await page.$('#cpimgr-capture'))!
        const clip = (await body.boundingBox())!
        const screenshot = (await page.screenshot({
          clip,
        })) as unknown as Buffer

        res.writeHead(200, {
          'content-type': 'image/png',
        })
        res.end(screenshot)

        break
      }

      case '/measure': {
        const result: Record<string, BoundingBox> = {}
        const elements = (await page.evaluate(
          "Array.from(document.querySelectorAll('[data-cpimgr-measure]')).map(x => x.getAttribute('data-cpimgr-measure'))",
        )) as string[]

        for (const elemId of elements) {
          const elem = (await page.$(`[data-cpimgr-measure="${elemId}"]`))!
          result[elemId] = (await elem.boundingBox())!
        }

        res.writeHead(200, {
          'content-type': 'application/json',
        })
        res.end(JSON.stringify(result))

        break
      }

      default: {
        console.log('[ctrl] 404 not found')
        res.writeHead(404)
        res.end('404 not found')
        break
      }
    }
  } catch (e) {
    console.log('[puppeteer]')
    console.log(e)

    try {
      res.writeHead(500)
      res.end(Buffer.allocUnsafe(0))
    } catch (_) {
      // Ignore
    }
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    if (!dev) page.close()
  }
}

// eslint-disable-next-line @typescript-eslint/no-misused-promises
createServer(controller).listen(5141, '0.0.0.0')

const req2Buffer = (req: IncomingMessage) => {
  const chunks: Uint8Array[] = []
  return new Promise<Buffer>((resolve, reject) => {
    req.on('data', (chunk) => {
      chunks.push(chunk as Uint8Array)
    })
    req.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
    req.on('error', () => {
      reject(new Error())
    })
  })
}

const req2String = (req: IncomingMessage) =>
  req2Buffer(req).then((b) => b.toString('utf-8'))
