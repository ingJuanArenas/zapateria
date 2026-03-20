"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Producto = {
  id: string;
  referencia: string;
  nombre: string;
  color: string | null;
  talla: string | null;
  cantidad_disponible: number;
  precio_mayorista: number | null;
};

export default function CatalogoPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTalla, setFiltroTalla] = useState<string>("");
  const [filtroColor, setFiltroColor] = useState<string>("");

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("productos")
        .select(
          "id, referencia, nombre, color, talla, cantidad_disponible, precio_mayorista",
        )
        .gt("cantidad_disponible", 0)
        .order("nombre", { ascending: true });

      if (error || !data) {
        setError("No se pudo cargar el catálogo.");
        setLoading(false);
        return;
      }

      setProductos(data as Producto[]);
      setLoading(false);
    };
    cargar();
  }, []);

  const tallasDisponibles = useMemo(
    () =>
      Array.from(
        new Set(
          productos
            .map((p) => p.talla || "")
            .filter((t) => t && t.trim().length > 0),
        ),
      ).sort(),
    [productos],
  );

  const coloresDisponibles = useMemo(
    () =>
      Array.from(
        new Set(
          productos
            .map((p) => p.color || "")
            .filter((c) => c && c.trim().length > 0),
        ),
      ).sort(),
    [productos],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (q) {
        const texto =
          (p.nombre || "") +
          " " +
          (p.referencia || "") +
          " " +
          (p.color || "") +
          " " +
          (p.talla || "");
        if (!texto.toLowerCase().includes(q)) return false;
      }
      if (filtroTalla && p.talla !== filtroTalla) return false;
      if (filtroColor && p.color !== filtroColor) return false;
      return true;
    });
  }, [productos, busqueda, filtroTalla, filtroColor]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="rounded-md bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">Catálogo para mayoristas</h1>
        <p className="text-sm text-slate-500">
          Catálogo actualizado en tiempo real. Solo productos con stock
          disponible.
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm md:flex-row md:items-center md:justify-between">
        <input
          type="text"
          placeholder="Buscar por nombre o referencia"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <div className="flex flex-wrap gap-2 text-xs">
          <select
            value={filtroTalla}
            onChange={(e) => setFiltroTalla(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-slate-400"
          >
            <option value="">Todas las tallas</option>
            {tallasDisponibles.map((t) => (
              <option key={t} value={t}>
                Talla {t}
              </option>
            ))}
          </select>
          <select
            value={filtroColor}
            onChange={(e) => setFiltroColor(e.target.value)}
            className="rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-slate-400"
          >
            <option value="">Todos los colores</option>
            {coloresDisponibles.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Cargando catálogo...
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
          No hay productos para mostrar con los filtros actuales.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((p) => (
            <div
              key={p.id}
              className="flex flex-col rounded-md border border-slate-200 bg-white p-3 text-sm"
            >
              <div className="mb-1 text-xs uppercase text-slate-400">
                Ref. {p.referencia}
              </div>
              <div className="mb-1 text-base font-semibold">{p.nombre}</div>
              <div className="mb-1 text-xs text-slate-600">
                {p.color && <span>Color: {p.color} · </span>}
                {p.talla && <span>Talla: {p.talla}</span>}
              </div>
              <div className="mb-2 text-xs text-slate-600">
                Cantidad disponible:{" "}
                <span className="font-semibold">
                  {p.cantidad_disponible} pares
                </span>
              </div>
              <div className="mt-auto flex items-end justify-between">
                <div className="text-xs text-slate-500">Precio mayorista</div>
                <div className="text-lg font-semibold text-slate-900">
                  {p.precio_mayorista
                    ? `$ ${p.precio_mayorista.toLocaleString("es-CO")}`
                    : "Consultar"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <footer className="pb-4 pt-2 text-center text-[11px] text-slate-400">
        Este catálogo es solo informativo. Para pedidos, comunícate con la
        zapatería por los canales habituales.
      </footer>
    </div>
  );
}


