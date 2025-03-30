try {
  if (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    !window.Telegram ||
    Number(window.Telegram.WebApp.version.split('.')[0]) < 7
  )
    window.history.pushState(null, '', '/upgradeapp')
} catch (_) {
  // Ignore
}
