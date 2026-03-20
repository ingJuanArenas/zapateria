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
};

type DetalleItem = {
  id: string;
  venta_id: string;
  cantidad: number;
  precio_unitario: number;
  producto_nombre: string;
  producto_referencia: string;
};

function CarteraContent() {
  const [ventas, setVentas] = useState<VentaConCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [ventaSeleccionada, setVentaSeleccionada] = useState<VentaConCliente | null>(null);
  const [detalle, setDetalle] = useState<DetalleItem[]>([]);
  const [detalleCargando, setDetalleCargando] = useState(false);

  const [ventaPago, setVentaPago] = useState<VentaConCliente | null>(null);
  const [montoPago, setMontoPago] = useState("");
  const [notasPago, setNotasPago] = useState("");
  const [guardandoPago, setGuardandoPago] = useState(false);

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

    const ventasConCliente: VentaConCliente[] = (ventasData as Venta[]).map(
      (v) => ({
        ...v,
        cliente: clientesMap.get(v.cliente_id),
      }),
    );

    setVentas(ventasConCliente);
    setLoading(false);
  }

  async function abrirDetalle(venta: VentaConCliente) {
    setVentaSeleccionada(venta);
    setDetalle([]);
    setDetalleCargando(true);

    const { data, error } = await supabase
      .from("venta_items")
      .select(
        "id, venta_id, cantidad, precio_unitario, productos (nombre, referencia)",
      )
      .eq("venta_id", venta.id);

    if (error || !data) {
      setError("No se pudo cargar el detalle de la venta.");
      setDetalleCargando(false);
      return;
    }

    const items: DetalleItem[] = (data as any[]).map((i) => ({
      id: i.id,
      venta_id: i.venta_id,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      producto_nombre: i.productos?.nombre ?? "Producto",
      producto_referencia: i.productos?.referencia ?? "",
    }));

    setDetalle(items);
    setDetalleCargando(false);
  }

  function abrirPago(venta: VentaConCliente) {
    setVentaPago(venta);
    setMontoPago("");
    setNotasPago("");
  }

  const totalCartera = useMemo(
    () =>
      ventas.reduce(
        (acc, v) => acc + (v.saldo_pendiente ?? 0),
        0,
      ),
    [ventas],
  );

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
      fecha: new Date().toISOString(),
      notas: notasPago.trim() || null,
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
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          <div className="text-xs text-slate-500">Total en cartera</div>
          <div className="text-base font-semibold text-slate-900">
            $ {totalCartera.toLocaleString("es-CO")}
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
                <th className="px-3 py-2">Teléfono</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Saldo pendiente</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-3 py-2 text-xs sm:text-sm">
                    {v.cliente?.nombre ?? "Cliente"}
                  </td>
                  <td className="px-3 py-2 text-xs sm:text-sm">
                    {v.cliente?.telefono ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-xs sm:text-sm">
                    {new Date(v.fecha).toLocaleDateString("es-CO")}
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
          <div className="w-full max-w-md rounded-md bg-white p-4 shadow-lg text-sm">
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


