"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthGuard } from "@/components/AuthGuard";

type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;

};

type VentaResumen = {
  id: string;
  fecha: string;
  total: number;
  modalidad: string;
  estado: string;
};

type ItemVentaCliente = {
  cantidad: number;
  precio_unitario: number;
  producto_nombre: string;
  producto_referencia: string;
};

type VentaConItems = VentaResumen & { items: ItemVentaCliente[] };

function etiquetaModalidad(m: string) {
  if (m === "credito") return "Crédito";
  if (m === "contado") return "Contado";
  return m;
}

function ClientesContent() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clienteActivo, setClienteActivo] = useState<Cliente | null>(null);
  const [ventasCliente, setVentasCliente] = useState<VentaConItems[]>([]);
  const [cargandoVentas, setCargandoVentas] = useState(false);
  const [errorCompras, setErrorCompras] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from("clientes")
        .select("id, nombre, telefono")
        .order("nombre", { ascending: true });
      if (err || !data) {
        setError("No se pudo cargar la lista de clientes.");
      } else {
        setClientes(data as Cliente[]);
      }
      setLoading(false);
    }
    cargar();
  }, []);

  const clientesOrdenados = useMemo(() => clientes, [clientes]);

  async function abrirCliente(cliente: Cliente) {
    setClienteActivo(cliente);
    setVentasCliente([]);
    setErrorCompras(null);
    setCargandoVentas(true);

    const { data: ventasData, error: ventasErr } = await supabase
      .from("ventas")
      .select("id, fecha, total, modalidad, estado")
      .eq("cliente_id", cliente.id)
      .order("fecha", { ascending: false });

    if (ventasErr || !ventasData) {
      setCargandoVentas(false);
      setErrorCompras("No se pudieron cargar las compras del cliente.");
      return;
    }

    const ventas = ventasData as VentaResumen[];
    const ids = ventas.map((v) => v.id);
    let itemsPorVenta = new Map<string, ItemVentaCliente[]>();

    if (ids.length > 0) {
      const { data: itemsData, error: itemsErr } = await supabase
        .from("venta_items")
        .select(
          "venta_id, cantidad, precio_unitario, productos (nombre, referencia)",
        )
        .in("venta_id", ids);

      if (!itemsErr && itemsData) {
        for (const row of itemsData as any[]) {
          const vid = row.venta_id as string;
          const item: ItemVentaCliente = {
            cantidad: row.cantidad,
            precio_unitario: row.precio_unitario,
            producto_nombre: row.productos?.nombre ?? "Producto",
            producto_referencia: row.productos?.referencia ?? "",
          };
          const list = itemsPorVenta.get(vid) ?? [];
          list.push(item);
          itemsPorVenta.set(vid, list);
        }
      }
    }

    const conItems: VentaConItems[] = ventas.map((v) => ({
      ...v,
      items: itemsPorVenta.get(v.id) ?? [],
    }));

    setVentasCliente(conItems);
    setCargandoVentas(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Clientes</h1>
        <p className="text-sm text-slate-500">
          Consulta el historial de compras por cliente.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        {loading ? (
          <div className="p-4 text-sm text-slate-500">Cargando clientes...</div>
        ) : clientesOrdenados.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">
            No hay clientes registrados.
          </div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Teléfono</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {clientesOrdenados.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  onClick={() => abrirCliente(c)}
                >
                  <td className="px-3 py-2 text-xs sm:text-sm">{c.nombre}</td>
                  <td className="px-3 py-2 text-xs sm:text-sm">{c.telefono ?? "-"}</td>
                  <td className="px-3 py-2 text-right text-[11px]">
                    <button
                      type="button"
                      className="rounded border border-slate-200 px-2 py-1 hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirCliente(c);
                      }}
                    >
                      Ver compras
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {clienteActivo && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md bg-white p-4 shadow-lg text-sm">
            <h2 className="mb-1 text-base font-semibold">
              Compras de {clienteActivo.nombre}
            </h2>
            <p className="text-sm text-slate-500">
              Teléfono: {clienteActivo.telefono ?? "-"}
            </p>
            {errorCompras && (
              <div className="mb-2 text-xs text-red-600">{errorCompras}</div>
            )}
            {cargandoVentas ? (
              <div className="text-xs text-slate-500">Cargando...</div>
            ) : errorCompras ? null : ventasCliente.length === 0 ? (
              <div className="text-xs text-slate-500">
                Este cliente aún no tiene ventas registradas.
              </div>
            ) : (
              <div className="space-y-3">
                {ventasCliente.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-md border border-slate-200 p-3 text-xs"
                  >
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="font-medium text-slate-800">
                        {new Date(v.fecha).toLocaleString("es-CO", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        <span className="mr-2">
                          {etiquetaModalidad(v.modalidad)}
                        </span>
                        <span className="rounded border border-slate-200 px-1.5 py-0.5">
                          {v.estado}
                        </span>
                        <span className="ml-2 font-semibold text-slate-900">
                          $ {v.total.toLocaleString("es-CO")}
                        </span>
                      </div>
                    </div>
                    {v.items.length === 0 ? (
                      <div className="text-[11px] text-slate-500">
                        Sin líneas de detalle.
                      </div>
                    ) : (
                      <ul className="space-y-1 text-[11px]">
                        {v.items.map((it, idx) => (
                          <li
                            key={`${v.id}-${idx}`}
                            className="flex justify-between gap-2 rounded border border-slate-100 px-2 py-1"
                          >
                            <span>
                              <span className="font-medium">
                                {it.producto_nombre}
                              </span>{" "}
                              <span className="text-slate-500">
                                ref. {it.producto_referencia}
                              </span>
                              <span className="text-slate-500">
                                {" "}
                                · {it.cantidad} ud × $
                                {it.precio_unitario.toLocaleString("es-CO")}
                              </span>
                            </span>
                            <span className="shrink-0 font-medium">
                              $
                              {(
                                it.cantidad * it.precio_unitario
                              ).toLocaleString("es-CO")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setClienteActivo(null);
                  setVentasCliente([]);
                  setErrorCompras(null);
                }}
                className="rounded border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientesPage() {
  return (
    <AuthGuard>
      <ClientesContent />
    </AuthGuard>
  );
}
