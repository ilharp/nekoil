import type { AppProps } from 'next/app'

import 'normalize.css'

import '@sym-app/components/styles/layout/index.scss'

import '@/styles/index.scss'

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
