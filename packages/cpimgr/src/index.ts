import type { CpimgrPayload } from 'nekoil-typedef'
import { Buffer } from 'node:buffer'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import { launch } from 'puppeteer-core'
import find from 'puppeteer-finder'

const browser = await launch({
  executablePath: find() as string,
})

const controller = async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== 'POST') {
    console.error('[ctrl] 405 method not allowed')
    res.writeHead(405)
    res.end()
    return
  }

  const payload = JSON.parse(await req2String(req)) as CpimgrPayload

  const page = await browser.newPage()

  let screenshot: Buffer

  try {
    await page.setExtraHTTPHeaders({
      'Nekoil-Cpssr-Data': Buffer.from(
        JSON.stringify(payload.cpwfData),
      ).toString('base64'),
    })
    await page.setJavaScriptEnabled(false)
    await page.goto(payload.cpssrUrl)
    await page.waitForNetworkIdle()

    const body = (await page.$('body'))!
    const clip = (await body.boundingBox())!
    screenshot = (await page.screenshot({ clip })) as unknown as Buffer
  } catch (e) {
    console.error('[puppeteer]')
    console.error(e)

    res.writeHead(500)
    res.end(Buffer.allocUnsafe(0))

    return
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    page.close()
  }

  res.writeHead(200, {
    'content-type': 'image/png',
  })
  res.end(screenshot)
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
