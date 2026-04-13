"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthGuard } from "@/components/AuthGuard";

type Venta = {
  id: string;
  cliente_id: string;
  total: number;
  saldo_pendiente: number;
  estado: string;
  fecha: string;
};

type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;
};

type VentaConCliente = Venta & {
  cliente?: Cliente;
  referencias?: string;
  colores?: string;
};

type DetalleItem = {
  id: string;
  venta_id: string;
  cantidad: number;
  precio_unitario: number;
  producto_nombre: string;
  producto_referencia: string;
};

type PagoHistorial = {
  id: string;
  venta_id: string;
  monto: number;
  fecha: string;
  notas: string | null;
  metodo_pago: string;
};

function CarteraContent(){
  const [ventas, setVentas] = useState<VentaConCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [orden, setOrden] = useState<"nombre" | "valor" | "fecha">("nombre");
  const [ventaSeleccionada, setVentaSeleccionada] = useState<VentaConCliente | null>(null);
  const [detalle, setDetalle] = useState<DetalleItem[]>([]);
  const [detalleCargando, setDetalleCargando] = useState(false);
  const [historialPagos, setHistorialPagos] = useState<
    (PagoHistorial & { saldo_despues: number })[]
  >([]);

  const [ventaPago, setVentaPago] = useState<VentaConCliente | null>(null);
  const [montoPago, setMontoPago] = useState("");
  const [notasPago, setNotasPago] = useState("");
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "nequi" | "transferencia">("efectivo");


  useEffect(() => {
    cargarCartera();
  }, []);

  async function cargarCartera() {
    setLoading(true);
    setError(null);
    setMensaje(null);

    const { data: ventasData, error: ventasError } = await supabase
      .from("ventas")
      .select("id, cliente_id, total, saldo_pendiente, estado, fecha")
      .gt("saldo_pendiente", 0)
      .order("fecha", { ascending: false });

    if (ventasError || !ventasData) {
      setError("No se pudo cargar la cartera.");
      setLoading(false);
      return;
    }

    const clientesIds = Array.from(
      new Set(ventasData.map((v) => v.cliente_id).filter(Boolean)),
    );

    let clientesMap = new Map<string, Cliente>();
    if (clientesIds.length > 0) {
      const { data: clientesData, error: clientesError } = await supabase
        .from("clientes")
        .select("id, nombre, telefono")
        .in("id", clientesIds);

      if (!clientesError && clientesData) {
        clientesMap = new Map(
          (clientesData as Cliente[]).map((c) => [c.id, c]),
        );
      }
    }

    const idsVentas = ventasData.map((v) => v.id);
    let referenciasMap = new Map<string, string>();
    let coloresMap = new Map<string, string>();
    
    if (idsVentas.length > 0) {
      const { data: itemsData } = await supabase
        .from("venta_items")
        .select("venta_id, productos (referencia, color)")
        .in("venta_id", idsVentas);
    
      if (itemsData) {
        const refsByVenta = new Map<string, Set<string>>();
        const coloresByVenta = new Map<string, Set<string>>();
        for (const item of itemsData as any[]) {
          const ref = item.productos?.referencia;
          const color = item.productos?.color;
          if (ref) {
            const refs = refsByVenta.get(item.venta_id) ?? new Set<string>();
            refs.add(ref);
            refsByVenta.set(item.venta_id, refs);
          }
          if (color) {
            const colores = coloresByVenta.get(item.venta_id) ?? new Set<string>();
            colores.add(color);
            coloresByVenta.set(item.venta_id, colores);
          }
        }
        for (const [ventaId, refs] of refsByVenta.entries()) {
          referenciasMap.set(ventaId, Array.from(refs).join(", "));
        }
        for (const [ventaId, colores] of coloresByVenta.entries()) {
          coloresMap.set(ventaId, Array.from(colores).join(", "));
        }
      }
    }
    
    const ventasConCliente: VentaConCliente[] = (ventasData as Venta[]).map(
      (v) => ({
        ...v,
        cliente: clientesMap.get(v.cliente_id),
        referencias: referenciasMap.get(v.id) ?? "-",
        colores: coloresMap.get(v.id) ?? "-",
      }),
    );

    setVentas(ventasConCliente);
    setLoading(false);
  }

  async function abrirDetalle(venta: VentaConCliente) {
    setVentaSeleccionada(venta);
    setDetalle([]);
    setHistorialPagos([]);
    setDetalleCargando(true);

    const [itemsRes, pagosRes] = await Promise.all([
      supabase
        .from("venta_items")
        .select(
          "id, venta_id, cantidad, precio_unitario, productos (nombre, referencia)",
        )
        .eq("venta_id", venta.id),
      supabase
        .from("pagos")
        .select("id, venta_id, monto, fecha, notas, metodo_pago")
        .eq("venta_id", venta.id)
        .order("fecha", { ascending: true }),
    ]);

    if (itemsRes.error || !itemsRes.data) {
      setError("No se pudo cargar el detalle de la venta.");
      setDetalleCargando(false);
      return;
    }

    const items: DetalleItem[] = (itemsRes.data as any[]).map((i) => ({
      id: i.id,
      venta_id: i.venta_id,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      producto_nombre: i.productos?.nombre ?? "Producto",
      producto_referencia: i.productos?.referencia ?? "",
    }));
    setDetalle(items);

    if (!pagosRes.error && pagosRes.data) {
      const pagosRaw = pagosRes.data as PagoHistorial[];
      const pagosOrdenados = [...pagosRaw].sort(
        (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
      );
      let acumulado = 0;
      const conSaldo = pagosOrdenados.map((p) => {
        acumulado += p.monto;
        return {
          ...p,
          saldo_despues: Math.max(0, venta.total - acumulado),
        };
      });
      setHistorialPagos(conSaldo);
    } else {
      setHistorialPagos([]);
    }
    setDetalleCargando(false);
  }

  function abrirPago(venta: VentaConCliente) {
    setVentaPago(venta);
    setMontoPago("");
    setNotasPago("");
    setMetodoPago("efectivo");
  }

  const ventasOrdenadas = useMemo(() => {
    return [...ventas].sort((a, b) => {
      if (orden === "nombre") {
        return (a.cliente?.nombre ?? "").localeCompare(b.cliente?.nombre ?? "");
      }
      if (orden === "fecha") {
        return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
      }
      return b.saldo_pendiente - a.saldo_pendiente;
    });
  }, [ventas, orden]);

  const totalCartera = useMemo(
    () =>
      ventas.reduce(
        (acc, v) => acc + (v.saldo_pendiente ?? 0),
        0,
      ),
    [ventas],
  );

  function imprimirCartera() {
    const fechaActual = new Date().toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const filas = ventasOrdenadas
      .map(
        (v) => `
        <tr>
          <td>${v.cliente?.nombre ?? "Cliente"}</td>
          <td>${v.referencias ?? "-"}</td>
          <td>${v.colores ?? "-"}</td>
          <td>$ ${v.total.toLocaleString("es-CO")}</td>
          <td>$ ${v.saldo_pendiente.toLocaleString("es-CO")}</td>
          <td>${v.estado}</td>
        </tr>`,
      )
      .join("");

    const contenido = `
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Cartera Kairos Store</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; padding: 28px; color: #1a1a1a; }
            h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
            .sub { text-align: center; color: #666; font-size: 11px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { border-bottom: 1px solid #ccc; padding: 6px 4px; text-align: left; color: #555; }
            td { border-bottom: 1px solid #eee; padding: 6px 4px; }
          </style>
        </head>
        <body>
          <h1>Kairos Store — Cartera</h1>
          <p class="sub">Fecha: ${fechaActual}</p>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Referencias</th>
                <th>Colores</th>
                <th>Total</th>
                <th>Saldo pendiente</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${filas}
            </tbody>
          </table>
          <script>window.onload = function(){ window.print(); }</script>
        </body>
      </html>
    `;
    const ventana = window.open("", "_blank");
    if (!ventana) return;
    ventana.document.write(contenido);
    ventana.document.close();
  }

  async function registrarPago(e: React.FormEvent) {
    e.preventDefault();
    if (!ventaPago) return;
    const monto = Number(montoPago || 0);
    if (monto <= 0) return;
    if (monto > (ventaPago.saldo_pendiente ?? 0)) {
      setError("El monto no puede ser mayor al saldo pendiente.");
      return;
    }

    setGuardandoPago(true);
    setError(null);
    setMensaje(null);

    const nuevoSaldo = (ventaPago.saldo_pendiente ?? 0) - monto;
    const nuevoEstado = nuevoSaldo <= 0 ? "pagada" : "parcial";

    const { error: pagoError } = await supabase.from("pagos").insert({
      venta_id: ventaPago.id,
      monto,
      fecha: new Date(new Date().getTime() - 5 * 60 * 60 * 1000).toISOString(),
      notas: notasPago.trim() || null,
      metodo_pago: metodoPago,
    });

    if (pagoError) {
      setError("No se pudo registrar el pago.");
      setGuardandoPago(false);
      return;
    }

    const { error: ventaError } = await supabase
      .from("ventas")
      .update({
        saldo_pendiente: nuevoSaldo,
        estado: nuevoEstado,
      })
      .eq("id", ventaPago.id);

    if (ventaError) {
      setError("El pago se guardó pero no se pudo actualizar la venta.");
      setGuardandoPago(false);
      return;
    }

    setMensaje("Pago registrado correctamente.");
    setVentaPago(null);
    await cargarCartera();
    setGuardandoPago(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cartera</h1>
          <p className="text-sm text-slate-500">
            Controla las ventas a crédito, saldos pendientes y pagos realizados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={imprimirCartera}
            className="rounded border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50"
          >
            Imprimir cartera
          </button>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <div className="text-xs text-slate-500">Total en cartera</div>
            <div className="text-base font-semibold text-slate-900">
              $ {totalCartera.toLocaleString("es-CO")}
            </div>
          </div>
        </div>
      </div>

      {(mensaje || error) && (
        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs">
          {mensaje && (
            <div className="mb-1 text-emerald-700">{mensaje}</div>
          )}
          {error && <div className="text-red-600">{error}</div>}
        </div>
      )}

      <div className="flex gap-2">
        <span className="text-xs text-slate-500 self-center">Ordenar por:</span>
        <button
          type="button"
          onClick={() => setOrden("nombre")}
          className={`rounded border px-2 py-1 text-[11px] ${orden === "nombre" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 hover:bg-slate-50"}`}
        >
          A → Z
        </button>
        <button
          type="button"
          onClick={() => setOrden("valor")}
          className={`rounded border px-2 py-1 text-[11px] ${orden === "valor" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 hover:bg-slate-50"}`}
        >
          Mayor deuda
        </button>
        <button
          type="button"
          onClick={() => setOrden("fecha")}
          className={`rounded border px-2 py-1 text-[11px] ${orden === "fecha" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 hover:bg-slate-50"}`}
        >
          Más antiguo
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        {loading ? (
          <div className="p-4 text-sm text-slate-500">
            Cargando cartera...
          </div>
        ) : ventas.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">
            No hay deudas activas en este momento.
          </div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Referencia</th>
                <th className="px-3 py-2">Colores</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Saldo pendiente</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ventasOrdenadas.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-3 py-2 text-xs sm:text-sm">
                    {v.cliente?.nombre ?? "Cliente"}
                  </td>
                  <td className="px-3 py-2 text-xs sm:text-sm">
                    {new Date(v.fecha).toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-3 py-2 text-xs sm:text-sm">
                    {v.referencias ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-xs sm:text-sm">
                    {v.colores ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-xs sm:text-sm">
                    $ {v.total.toLocaleString("es-CO")}
                  </td>
                  <td className="px-3 py-2 text-xs sm:text-sm">
                    $ {v.saldo_pendiente.toLocaleString("es-CO")}
                  </td>
                  <td className="px-3 py-2 text-xs sm:text-sm">
                    {v.estado}
                  </td>
                  <td className="px-3 py-2 text-right text-xs sm:text-sm">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => abrirDetalle(v)}
                        className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
                      >
                        Ver detalle
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirPago(v)}
                        className="rounded border border-emerald-200 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-50"
                      >
                        Registrar pago
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {ventaSeleccionada && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md bg-white p-4 shadow-lg text-sm">
            <h2 className="mb-2 text-base font-semibold">
              Detalle de la deuda
            </h2>
            <p className="mb-2 text-xs text-slate-600">
              Cliente:{" "}
              <span className="font-medium">
                {ventaSeleccionada.cliente?.nombre ?? "Cliente"}
              </span>
            </p>
            <p className="mb-2 text-xs text-slate-600">
              Fecha:{" "}
              {new Date(ventaSeleccionada.fecha).toLocaleDateString("es-CO")}
            </p>
            <p className="mb-3 text-xs text-slate-600">
              Total: ${" "}
              {ventaSeleccionada.total.toLocaleString("es-CO")} | Saldo
              pendiente: ${" "}
              {ventaSeleccionada.saldo_pendiente.toLocaleString("es-CO")}
            </p>

            {detalleCargando ? (
              <div className="text-xs text-slate-500">
                Cargando productos...
              </div>
            ) : detalle.length === 0 ? (
              <div className="text-xs text-slate-500">
                No se encontraron productos para esta venta.
              </div>
            ) : (
              <div className="mb-3 max-h-48 space-y-1 overflow-y-auto text-xs">
                {detalle.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded border border-slate-100 px-2 py-1"
                  >
                    <div>
                      <div className="font-medium">
                        {d.producto_nombre}{" "}
                        <span className="text-[11px] text-slate-500">
                          {d.producto_referencia}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Cantidad: {d.cantidad}
                      </div>
                    </div>
                    <div className="text-right text-[11px]">
                      <div>
                        x ${d.precio_unitario.toLocaleString("es-CO")}
                      </div>
                      <div className="font-semibold">
                        $
                        {(
                          d.cantidad * d.precio_unitario
                        ).toLocaleString("es-CO")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 border-t border-slate-200 pt-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Historial de abonos
              </h3>
              {detalleCargando ? (
                <div className="text-xs text-slate-500">
                  Cargando abonos...
                </div>
              ) : historialPagos.length === 0 ? (
                <div className="text-xs text-slate-500">
                  No hay abonos registrados para esta venta.
                </div>
              ) : (
                <div className="overflow-x-auto rounded border border-slate-100">
                  <table className="min-w-full text-left text-[11px]">
                    <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5">Fecha</th>
                        <th className="px-2 py-1.5">Monto</th>
                        <th className="px-2 py-1.5">Método</th>
                        <th className="px-2 py-1.5">Notas</th>
                        <th className="px-2 py-1.5 text-right">Saldo después</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialPagos.map((p) => (
                        <tr
                          key={p.id}
                          className="border-b border-slate-50 last:border-0"
                        >
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {new Date(p.fecha).toLocaleString("es-CO", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="px-2 py-1.5">
                            ${p.monto.toLocaleString("es-CO")}
                          </td>
                          <td className="px-2 py-1.5 capitalize">
                            {p.metodo_pago ?? "—"}
                          </td>
                          <td className="max-w-[140px] px-2 py-1.5 truncate text-slate-600" title={p.notas ?? ""}>
                            {p.notas ?? "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium">
                            ${p.saldo_despues.toLocaleString("es-CO")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setVentaSeleccionada(null)}
                className="rounded border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {ventaPago && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-md bg-white p-4 shadow-lg text-sm">
            <h2 className="mb-2 text-base font-semibold">Registrar pago</h2>
            <p className="mb-2 text-xs text-slate-600">
              Cliente:{" "}
              <span className="font-medium">
                {ventaPago.cliente?.nombre ?? "Cliente"}
              </span>
            </p>
            <p className="mb-3 text-xs text-slate-600">
              Saldo pendiente: ${" "}
              {ventaPago.saldo_pendiente.toLocaleString("es-CO")}
            </p>
            <form onSubmit={registrarPago} className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs">Monto del pago</label>
                <input
                  type="number"
                  min={1}
                  max={ventaPago.saldo_pendiente}
                  required
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
              <div>
              <label className="mb-1 block text-xs">Método de pago</label>
              <div className="flex gap-2">
                {(["efectivo", "nequi", "transferencia"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetodoPago(m)}
                    className={`rounded border px-2 py-1 text-[11px] capitalize ${
                      metodoPago === m
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
                <label className="mb-1 block text-xs">
                  Notas (opcional)
                </label>
                <textarea
                  rows={2}
                  value={notasPago}
                  onChange={(e) => setNotasPago(e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-slate-400"
                />
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVentaPago(null)}
                  className="rounded border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoPago}
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {guardandoPago ? "Guardando..." : "Guardar pago"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


export default function CarteraPage() {
  return (
    <AuthGuard>
      <CarteraContent />
    </AuthGuard>
  );
}


