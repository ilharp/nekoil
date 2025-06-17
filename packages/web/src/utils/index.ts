export const isUrlAbsolute = (url: string) =>
  new URL(document.baseURI).origin !== new URL(url, document.baseURI).origin
