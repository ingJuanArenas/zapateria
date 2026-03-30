import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zapatería - Gestión",
  description: "Sistema simple para gestionar inventario, ventas y cartera de una zapatería.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen">
          <aside className="hidden w-60 flex-shrink-0 border-r border-slate-200 bg-white px-4 py-6 md:block">
            <div className="mb-8">
              <div className="text-lg font-semibold">Zapatería</div>
              <div className="text-xs text-slate-500">
                Gestión de inventario, ventas y cartera
              </div>
            </div>
            <nav className="space-y-2 text-sm">
              <a href="/" className="block rounded px-2 py-1.5 hover:bg-slate-100">
                🏠 Dashboard
              </a>
              <a href="/inventario" className="block rounded px-2 py-1.5 hover:bg-slate-100">
                📦 Inventario
              </a>
              <a href="/ventas" className="block rounded px-2 py-1.5 hover:bg-slate-100">
                🧾 Ventas
              </a>
              <a href="/clientes" className="block rounded px-2 py-1.5 hover:bg-slate-100">
                👤 Clientes
              </a>
              <a href="/cartera" className="block rounded px-2 py-1.5 hover:bg-slate-100">
                💳 Cartera
              </a>
              <a href="/catalogo" className="block rounded px-2 py-1.5 hover:bg-slate-100">
                🔗 Catálogo público
              </a>
            </nav>
          </aside>
          <main className="flex-1">
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
              <div>
                <div className="text-base font-semibold">Zapatería</div>
                <div className="text-xs text-slate-500">Menú principal</div>
              </div>
              <nav className="flex gap-2 text-xs">
                <a href="/" className="rounded px-2 py-1 hover:bg-slate-100">
                  🏠
                </a>
                <a href="/inventario" className="rounded px-2 py-1 hover:bg-slate-100">
                  📦
                </a>
                <a href="/ventas" className="rounded px-2 py-1 hover:bg-slate-100">
                  🧾
                </a>
                <a href="/clientes" className="rounded px-2 py-1 hover:bg-slate-100" title="Clientes">
                  👤
                </a>
                <a href="/cartera" className="rounded px-2 py-1 hover:bg-slate-100">
                  💳
                </a>
                <a href="/catalogo" className="rounded px-2 py-1 hover:bg-slate-100">
                  🔗
                </a>
              </nav>
            </header>
            <div className="px-4 py-4 md:px-8 md:py-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
