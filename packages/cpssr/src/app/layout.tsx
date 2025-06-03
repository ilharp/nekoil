export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html>
      <bod>
        {children}
      </body>
    </html>
  );
}
