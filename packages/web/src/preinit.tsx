try {
  if (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    !window.Telegram?.WebApp.isVersionAtLeast('6.1')
  )
    throw new Error()

  window.history.replaceState(
    null,
    '',
    '/' + (window.Telegram.WebApp.initDataUnsafe.start_param ?? ''),
  )
} catch (_) {
  window.history.replaceState(null, '', '/upgradeapp')
}
