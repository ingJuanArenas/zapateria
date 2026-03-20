"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthGuard } from "@/components/AuthGuard";

type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;
  tipo: string | null;
};

type Producto = {
  id: string;
  referencia: string;
  nombre: string;
  cantidad_disponible: number;
  precio_unitario: number | null;
};

type ItemCarrito = {
  producto: Producto;
  cantidad: number;
  precio_unitario: number;
};

type Modalidad = "contado" | "credito";

function VentasContent() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [clienteId, setClienteId] = useState<string>("");
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState("");
  const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState("");
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [modalidad, setModalidad] = useState<Modalidad>("contado");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      const [clientesRes, productosRes] = await Promise.all([
        supabase
          .from("clientes")
          .select("id, nombre, telefono, tipo")
          .order("nombre", { ascending: true }),
        supabase
          .from("productos")
          .select(
            "id, referencia, nombre, cantidad_disponible, precio_unitario",
          )
          .order("nombre", { ascending: true }),
      ]);

      if (clientesRes.error || productosRes.error) {
        setError("No se pudo cargar la información inicial.");
      } else {
        setClientes(clientesRes.data as Cliente[]);
        setProductos(productosRes.data as Producto[]);
      }
      setLoading(false);
    };
    cargar();
  }, []);

  const productosFiltrados = useMemo(() => {
    const q = busquedaProducto.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => {
      const texto = (p.nombre || "") + " " + (p.referencia || "");
      return texto.toLowerCase().includes(q);
    });
  }, [productos, busquedaProducto]);

  const total = useMemo(
    () =>
      carrito.reduce(
        (acc, item) => acc + item.cantidad * item.precio_unitario,
        0,
      ),
    [carrito],
  );

  function agregarAlCarrito(producto: Producto) {
    setError(null);
    setMensaje(null);
    const existente = carrito.find((i) => i.producto.id === producto.id);
    const precioBase = producto.precio_unitario || 0;
    if (!existente) {
      if (producto.cantidad_disponible <= 0) {
        setError("No hay stock disponible para este producto.");
        return;
      }
      setCarrito((prev) => [
        ...prev,
        { producto, cantidad: 1, precio_unitario: precioBase },
      ]);
    } else {
      const nuevaCantidad = existente.cantidad + 1;
      if (nuevaCantidad > producto.cantidad_disponible) {
        setError("No puedes vender más unidades de las disponibles.");
        return;
      }
      setCarrito((prev) =>
        prev.map((i) =>
          i.producto.id === producto.id ? { ...i, cantidad: nuevaCantidad } : i,
        ),
      );
    }
  }

  function actualizarCantidad(idProducto: string, cantidad: number) {
    setError(null);
    setMensaje(null);
    const prod = productos.find((p) => p.id === idProducto);
    if (!prod) return;
    if (cantidad <= 0) {
      setCarrito((prev) => prev.filter((i) => i.producto.id !== idProducto));
      return;
    }
    if (cantidad > prod.cantidad_disponible) {
      setError("No puedes vender más unidades de las disponibles.");
      return;
    }
    setCarrito((prev) =>
      prev.map((i) =>
        i.producto.id === idProducto ? { ...i, cantidad } : i,
      ),
    );
  }

  function quitarDelCarrito(idProducto: string) {
    setCarrito((prev) => prev.filter((i) => i.producto.id !== idProducto));
  }

  async function crearClienteRapido(): Promise<string | null> {
    const nombre = nuevoClienteNombre.trim();
    if (!nombre) {
      setError("Escribe al menos el nombre del cliente.");
      return null;
    }
  
    // Buscar si ya existe un cliente con ese nombre
    const { data: existente } = await supabase
      .from("clientes")
      .select("id, nombre, telefono, tipo")
      .ilike("nombre", nombre)
      .maybeSingle();
  
    if (existente) {
      setError(`El cliente "${existente.nombre}" ya existe. Selecciónalo de la lista.`);
      setClientes((prev) =>
        prev.find((c) => c.id === existente.id)
          ? prev
          : [...prev, existente]
      );
      return null;
    }
  
    const payload = {
      nombre,
      telefono: nuevoClienteTelefono.trim() || null,
      tipo: modalidad === "credito" ? "credito" : "contado",
    };
    const { data, error } = await supabase
      .from("clientes")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) {
      setError("No se pudo crear el cliente.");
      return null;
    }
    setClientes((prev) => [
      ...prev,
      { id: data.id, nombre, telefono: payload.telefono, tipo: payload.tipo },
    ]);
    setNuevoClienteNombre("");
    setNuevoClienteTelefono("");
    return data.id as string;
  }

  async function registrarVenta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);

    if (carrito.length === 0) {
      setError("Agrega al menos un producto a la venta.");
      return;
    }

    setGuardando(true);

    try {
      let idCliente = clienteId;
      if (!idCliente) {
        const nuevo = await crearClienteRapido();
        if (!nuevo) {
          setGuardando(false);
          return;
        }
        idCliente = nuevo;
      }

      const idsProductos = carrito.map((i) => i.producto.id);
      const { data: productosActuales, error: errorProductos } = await supabase
        .from("productos")
        .select("id, cantidad_disponible")
        .in("id", idsProductos);

      if (errorProductos || !productosActuales) {
        setError("No se pudo validar el stock actual.");
        setGuardando(false);
        return;
      }

      for (const item of carrito) {
        const actual = productosActuales.find(
          (p) => p.id === item.producto.id,
        ) as { id: string; cantidad_disponible: number } | undefined;
        if (!actual) continue;
        if (item.cantidad > (actual.cantidad_disponible ?? 0)) {
          setError(
            `No hay suficiente stock para ${item.producto.nombre}. Ajusta las cantidades.`,
          );
          setGuardando(false);
          return;
        }
      }

      const totalVenta = total;
      const esCredito = modalidad === "credito";

      const { data: venta, error: errorVenta } = await supabase
        .from("ventas")
        .insert({
          cliente_id: idCliente,
          total: totalVenta,
          modalidad,
          saldo_pendiente: esCredito ? totalVenta : 0,
          estado: esCredito ? "pendiente" : "pagada",
          notas: notas.trim() || null,
        })
        .select("id")
        .single();

      if (errorVenta || !venta) {
        setError("No se pudo registrar la venta.");
        setGuardando(false);
        return;
      }

      const itemsPayload = carrito.map((item) => ({
        venta_id: venta.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      }));

      const { error: errorItems } = await supabase
        .from("venta_items")
        .insert(itemsPayload);

      if (errorItems) {
        setError(
          "La venta se creó pero hubo un problema al guardar los productos.",
        );
        setGuardando(false);
        return;
      }

      for (const item of carrito) {
        const actual = productosActuales.find(
          (p) => p.id === item.producto.id,
        ) as { id: string; cantidad_disponible: number };
        const nuevoStock = (actual.cantidad_disponible ?? 0) - item.cantidad;
        await supabase
          .from("productos")
          .update({ cantidad_disponible: nuevoStock })
          .eq("id", item.producto.id);
      }

      setMensaje(
        esCredito
          ? "Venta registrada a crédito. El saldo quedó en cartera."
          : "Venta registrada correctamente.",
      );
      setCarrito([]);
      setNotas("");
      setClienteId("");
      setGuardando(false);
    } catch {
      setError("Ocurrió un error al registrar la venta.");
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Registrar venta</h1>
          <p className="text-sm text-slate-500">
            Registra ventas rápidas, descuenta stock y controla si es contado o
            crédito.
          </p>
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

      <form
        onSubmit={registrarVenta}
        className="grid gap-4 md:grid-cols-[2fr,1.4fr]"
      >
        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
            <h2 className="mb-2 text-sm font-semibold">Cliente</h2>
            {loading ? (
              <div className="text-xs text-slate-500">
                Cargando clientes...
              </div>
            ) : (
              <>
                <label className="mb-1 block text-xs text-slate-600">
                  Seleccionar cliente existente
                </label>
                <select
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="mb-2 w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">-- Sin seleccionar --</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.telefono ? `(${c.telefono})` : ""}
                    </option>
                  ))}
                </select>

                <div className="mt-2 border-t border-dashed border-slate-200 pt-2">
                  <div className="mb-1 text-xs font-medium text-slate-600">
                    O crear cliente rápido
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Nombre"
                      value={nuevoClienteNombre}
                      onChange={(e) =>
                        setNuevoClienteNombre(e.target.value)
                      }
                      className="rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Teléfono (opcional)"
                      value={nuevoClienteTelefono}
                      onChange={(e) =>
                        setNuevoClienteTelefono(e.target.value)
                      }
                      className="rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Si no seleccionas un cliente de la lista, se creará uno
                    nuevo con estos datos.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
            <h2 className="mb-2 text-sm font-semibold">Productos</h2>
            <input
              type="text"
              placeholder="Buscar por nombre o referencia"
              value={busquedaProducto}
              onChange={(e) => setBusquedaProducto(e.target.value)}
              className="mb-2 w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
            />
            {loading ? (
              <div className="text-xs text-slate-500">
                Cargando productos...
              </div>
            ) : productosFiltrados.length === 0 ? (
              <div className="text-xs text-slate-500">
                No hay productos para mostrar.
              </div>
            ) : (
              <div className="max-h-52 space-y-1 overflow-y-auto text-xs">
                {productosFiltrados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => agregarAlCarrito(p)}
                    className="flex w-full items-center justify-between rounded border border-slate-200 px-2 py-1 text-left hover:bg-slate-50"
                  >
                    <div>
                      <div className="font-medium">
                        {p.nombre}{" "}
                        <span className="text-[11px] text-slate-500">
                          {p.referencia}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Stock: {p.cantidad_disponible} ud
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-700">
                      {p.precio_unitario
                        ? `$ ${p.precio_unitario.toLocaleString("es-CO")}`
                        : "-"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
            <h2 className="mb-2 text-sm font-semibold">Resumen de la venta</h2>
            {carrito.length === 0 ? (
              <div className="text-xs text-slate-500">
                No has agregado productos todavía.
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {carrito.map((item) => (
                  <div
                    key={item.producto.id}
                    className="flex items-center justify-between gap-2 rounded border border-slate-100 px-2 py-1"
                  >
                    <div>
                      <div className="font-medium">{item.producto.nombre}</div>
                      <div className="text-[11px] text-slate-500">
                        Stock: {item.producto.cantidad_disponible} ud
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={item.producto.cantidad_disponible}
                        value={item.cantidad}
                        onChange={(e) =>
                          actualizarCantidad(
                            item.producto.id,
                            Number(e.target.value || 0),
                          )
                        }
                        className="w-12 rounded border border-slate-200 px-1 py-0.5 text-right text-[11px] outline-none focus:border-slate-400"
                      />
                      <div className="text-[11px] text-slate-700">
                        x ${item.precio_unitario.toLocaleString("es-CO")}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-900">
                        $
                        {(
                          item.cantidad * item.precio_unitario
                        ).toLocaleString("es-CO")}
                      </div>
                      <button
                        type="button"
                        onClick={() => quitarDelCarrito(item.producto.id)}
                        className="ml-1 text-[11px] text-red-600"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 border-t border-slate-100 pt-2 text-xs">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-slate-600">Modalidad:</span>
                <button
                  type="button"
                  onClick={() => setModalidad("contado")}
                  className={`rounded border px-2 py-1 text-[11px] ${
                    modalidad === "contado"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Contado
                </button>
                <button
                  type="button"
                  onClick={() => setModalidad("credito")}
                  className={`rounded border px-2 py-1 text-[11px] ${
                    modalidad === "credito"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Crédito
                </button>
              </div>
              <label className="mb-1 block text-xs text-slate-600">
                Notas (opcional)
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-slate-400"
              />

              <div className="mt-3 flex items-center justify-between text-sm">
                <div className="text-xs text-slate-600">
                  Total a pagar{" "}
                  {modalidad === "credito" && (
                    <span className="font-medium text-amber-700">
                      (queda en cartera)
                    </span>
                  )}
                </div>
                <div className="text-base font-semibold text-slate-900">
                  $ {total.toLocaleString("es-CO")}
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={guardando || carrito.length === 0}
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {guardando ? "Guardando venta..." : "Confirmar venta"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function VentasPage() {
  return (
    <AuthGuard>
      <VentasContent />
    </AuthGuard>
  );
}


