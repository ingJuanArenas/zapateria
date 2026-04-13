"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthGuard } from "@/components/AuthGuard";

type Gasto = {
  id: string;
  descripcion: string;
  monto: number;
  categoria: string;
  fecha: string;
};

type ProductoBajo = {
  id: string;
  nombre: string;
  referencia: string;
  cantidad_disponible: number;
};

type Resumen = {
  totalCartera: number;
  ventasMes: number;
  gastosMes: number;
  productosBajos: ProductoBajo[];
  valorInventario: number;
};

function getMesRango() {
  const ahora = new Date();
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  return {
    desde: inicio.toISOString(),
    hasta: fin.toISOString(),
  };
}

function DashboardContent() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("proveedores");
  const [guardandoGasto, setGuardandoGasto] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    setError(null);
    setMensaje(null);

    const { desde, hasta } = getMesRango();

    const [
      carteraRes,
      ventasMesRes,
      gastosMesRes,
      productosBajosRes,
      gastosListaRes,
      inventarioRes,
      ] = await Promise.all([
      supabase
        .from("ventas")
        .select("saldo_pendiente")
        .gt("saldo_pendiente", 0),
      supabase
        .from("ventas")
        .select("total, fecha")
        .gte("fecha", desde)
        .lt("fecha", hasta),
      supabase
        .from("gastos")
        .select("monto, fecha")
        .gte("fecha", desde)
        .lt("fecha", hasta),
      supabase
        .from("productos")
        .select("id, nombre, referencia, cantidad_disponible")
        .lt("cantidad_disponible", 5)
        .order("cantidad_disponible", { ascending: true }),
      supabase
        .from("gastos")
        .select("id, descripcion, monto, categoria, fecha")
        .gte("fecha", desde)
        .lt("fecha", hasta)
        .order("fecha", { ascending: false }),
        supabase
        .from("productos")
        .select("cantidad_disponible, precio_costo"),
    ]);

    if (
      carteraRes.error ||
      ventasMesRes.error ||
      gastosMesRes.error ||
      productosBajosRes.error ||
      gastosListaRes.error ||
      inventarioRes.error
    ) {
      setError("No se pudo cargar el resumen. Intenta nuevamente.");
      setLoading(false);
      return;
    }

    const totalCartera =
      (carteraRes.data as { saldo_pendiente: number }[]).reduce(
        (acc, v) => acc + (v.saldo_pendiente ?? 0),
        0,
      );
    const ventasMes =
      (ventasMesRes.data as { total: number }[]).reduce(
        (acc, v) => acc + (v.total ?? 0),
        0,
      );
    const gastosMes =
      (gastosMesRes.data as { monto: number }[]).reduce(
        (acc, g) => acc + (g.monto ?? 0),
        0,
      );

      const valorInventario = (
        inventarioRes.data as { cantidad_disponible: number; precio_costo: number }[]
      ).reduce((acc, p) => acc + (p.cantidad_disponible ?? 0) * (p.precio_costo ?? 0), 0);
      
      setResumen({
        totalCartera,
        ventasMes,
        gastosMes,
        productosBajos: productosBajosRes.data as ProductoBajo[],
        valorInventario,
      });
    setGastos(gastosListaRes.data as Gasto[]);
    setLoading(false);
  }

  async function registrarGasto(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoGasto(true);
    setError(null);
    setMensaje(null);

    const payload = {
      descripcion: descripcion.trim(),
      monto: Number(monto || 0),
      categoria,
      fecha: new Date().toISOString(),
    };

    const { error: gastoError } = await supabase
      .from("gastos")
      .insert(payload);

    if (gastoError) {
      setError("No se pudo registrar el gasto.");
      setGuardandoGasto(false);
      return;
    }

    setDescripcion("");
    setMonto("");
    setCategoria("proveedores");
    setMensaje("Gasto registrado.");
    await cargarDatos();
    setGuardandoGasto(false);
  }

  const tituloMes = useMemo(() => {
    const ahora = new Date();
    return ahora.toLocaleDateString("es-CO", {
      month: "long",
      year: "numeric",
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Resumen rápido de la zapatería y registro de gastos del mes.
          </p>
        </div>
        <div className="text-xs text-slate-500">Mes actual: {tituloMes}</div>
      </div>

      {(mensaje || error) && (
        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs">
          {mensaje && (
            <div className="mb-1 text-emerald-700">{mensaje}</div>
          )}
          {error && <div className="text-red-600">{error}</div>}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">💰 Total en cartera</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {loading || !resumen
              ? "..."
              : `$ ${resumen.totalCartera.toLocaleString("es-CO")}`}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">📦 Stock bajo (&lt; 5)</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {loading || !resumen ? "..." : resumen.productosBajos.length}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">📈 Ventas del mes</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {loading || !resumen
              ? "..."
              : `$ ${resumen.ventasMes.toLocaleString("es-CO")}`}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">💸 Gastos del mes</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {loading || !resumen
              ? "..."
              : `$ ${resumen.gastosMes.toLocaleString("es-CO")}`}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">🏭 Valor inventario</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {loading || !resumen
              ? "..."
              : `$ ${resumen.valorInventario.toLocaleString("es-CO")}`}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.4fr,2fr]">
        <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
          <h2 className="mb-2 text-sm font-semibold">
            Registrar gasto rápido
          </h2>
          <form onSubmit={registrarGasto} className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs text-slate-600">
                Descripción
              </label>
              <input
                type="text"
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-slate-600">
                  Monto
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">
                  Categoría
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                >
                  <option value="arriendo">Arriendo</option>
                  <option value="servicios">Servicios</option>
                  <option value="proveedores">Proveedores</option>
                  <option value="nomina">Nómina</option>
                  <option value="otros">Otros</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={guardandoGasto}
              className="mt-2 w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {guardandoGasto ? "Guardando..." : "Guardar gasto"}
            </button>
          </form>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
          <h2 className="mb-2 text-sm font-semibold">
            Gastos del mes actual
          </h2>
          {loading ? (
            <div className="text-xs text-slate-500">Cargando gastos...</div>
          ) : gastos.length === 0 ? (
            <div className="text-xs text-slate-500">
              Aún no has registrado gastos este mes.
            </div>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto text-xs">
              {gastos.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded border border-slate-100 px-2 py-1"
                >
                  <div>
                    <div className="font-medium">{g.descripcion}</div>
                    <div className="text-[11px] text-slate-500">
                      {g.categoria} ·{" "}
                      {new Date(g.fecha).toLocaleDateString("es-CO")}
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-900">
                    $ {g.monto.toLocaleString("es-CO")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
        <h2 className="mb-2 text-sm font-semibold">Productos con stock bajo</h2>
        {loading ? (
          <div className="text-xs text-slate-500">Cargando productos...</div>
        ) : !resumen || resumen.productosBajos.length === 0 ? (
          <div className="text-xs text-slate-500">
            No hay productos con stock bajo.
          </div>
        ) : (
          <div className="max-h-52 space-y-1 overflow-y-auto text-xs">
            {resumen.productosBajos.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded border border-slate-100 px-2 py-1"
              >
                <div>
                  <div className="font-medium">{p.nombre}</div>
                  <div className="text-[11px] text-slate-500">
                    {p.referencia}
                  </div>
                </div>
                <div className="rounded bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-800">
                  {p.cantidad_disponible} ud
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

