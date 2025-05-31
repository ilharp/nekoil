const pathDecodeWhitelist = ['upgradeapp', 'banned']

try {
  if (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    !window.Telegram?.WebApp.isVersionAtLeast('6.1')
  )
    throw new Error()

  let path = window.Telegram.WebApp.initDataUnsafe.start_param ?? ''

  if (!pathDecodeWhitelist.includes(path)) {
    path = atob(path.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map((c) => String.fromCharCode(c.charCodeAt(0)))
      .join('')
  }

  window.history.replaceState(
    null,
    '',
    '/' + (window.Telegram.WebApp.initDataUnsafe.start_param ?? ''),
  )
} catch (_) {
  window.history.replaceState(null, '', '/upgradeapp')
}
