"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthGuard } from "@/components/AuthGuard";

type Producto = {
  id: string;
  referencia: string;
  nombre: string;
  color: string | null;
  talla: string | null;
  cantidad_disponible: number;
  precio_unitario: number | null;
  precio_mayorista: number | null;
};

type FormState = {
  referencia: string;
  nombre: string;
  color: string;
  talla: string;
  cantidad_disponible: string;
  precio_unitario: string;
  precio_mayorista: string;
};

const emptyForm: FormState = {
  referencia: "",
  nombre: "",
  color: "",
  talla: "",
  cantidad_disponible: "",
  precio_unitario: "",
  precio_mayorista: "",
};

function InventarioContent() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [stockProducto, setStockProducto] = useState<Producto | null>(null);
  const [stockCantidad, setStockCantidad] = useState("");
  const [stockTipo, setStockTipo] = useState<"entrada" | "salida">("entrada");
  const [stockGuardando, setStockGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    cargarProductos();
  }, []);

  async function cargarProductos() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("productos")
      .select(
        "id, referencia, nombre, color, talla, cantidad_disponible, precio_unitario, precio_mayorista",
      )
      .order("nombre", { ascending: true });

    if (error) {
      setError("No se pudo cargar el inventario. Intenta de nuevo.");
    } else {
      setProductos(data as Producto[]);
    }
    setLoading(false);
  }

  function abrirCrear() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function abrirEditar(p: Producto) {
    setEditing(p);
    setForm({
      referencia: p.referencia ?? "",
      nombre: p.nombre ?? "",
      color: p.color ?? "",
      talla: p.talla ?? "",
      cantidad_disponible: String(p.cantidad_disponible ?? ""),
      precio_unitario: p.precio_unitario ? String(p.precio_unitario) : "",
      precio_mayorista: p.precio_mayorista ? String(p.precio_mayorista) : "",
    });
    setShowForm(true);
  }

  function onChangeForm<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function guardarProducto(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMensaje(null);

    const payload = {
      referencia: form.referencia.trim(),
      nombre: form.nombre.trim(),
      color: form.color.trim() || null,
      talla: form.talla.trim() || null,
      cantidad_disponible: Number(form.cantidad_disponible || 0),
      precio_unitario: form.precio_unitario
        ? Number(form.precio_unitario)
        : null,
      precio_mayorista: form.precio_mayorista
        ? Number(form.precio_mayorista)
        : null,
    };

    let errorOp = null;
    if (editing) {
      const { error } = await supabase
        .from("productos")
        .update(payload)
        .eq("id", editing.id);
      errorOp = error;
    } else {
      const { error } = await supabase.from("productos").insert(payload);
      errorOp = error;
    }

    if (errorOp) {
      setError("No se pudo guardar el producto. Revisa los datos e intenta nuevamente.");
    } else {
      setMensaje("Producto guardado correctamente.");
      setShowForm(false);
      setForm(emptyForm);
      setEditing(null);
      await cargarProductos();
    }
    setSaving(false);
  }

  async function eliminarProducto(p: Producto) {
    const confirmar = window.confirm(
      `¿Seguro que quieres eliminar el producto "${p.nombre}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmar) return;
    setError(null);
    setMensaje(null);

    const { error } = await supabase.from("productos").delete().eq("id", p.id);
    if (error) {
      setError("No se pudo eliminar el producto.");
    } else {
      setMensaje("Producto eliminado.");
      await cargarProductos();
    }
  }

  function abrirAjusteStock(p: Producto) {
    setStockProducto(p);
    setStockCantidad("");
    setStockTipo("entrada");
  }

  async function guardarAjusteStock(e: React.FormEvent) {
    e.preventDefault();
    if (!stockProducto) return;
    const cantidad = Number(stockCantidad || 0);
    if (!cantidad || cantidad <= 0) return;

    setStockGuardando(true);
    setError(null);
    setMensaje(null);

    let nuevaCantidad =
      stockTipo === "entrada"
        ? stockProducto.cantidad_disponible + cantidad
        : stockProducto.cantidad_disponible - cantidad;
    if (nuevaCantidad < 0) nuevaCantidad = 0;

    const { error } = await supabase
      .from("productos")
      .update({ cantidad_disponible: nuevaCantidad })
      .eq("id", stockProducto.id);

    if (error) {
      setError("No se pudo ajustar el stock.");
    } else {
      setMensaje("Stock actualizado.");
      setStockProducto(null);
      await cargarProductos();
    }

    setStockGuardando(false);
  }

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => {
      const texto =
        (p.nombre || "") +
        " " +
        (p.referencia || "") +
        " " +
        (p.color || "") +
        " " +
        (p.talla || "");
      return texto.toLowerCase().includes(q);
    });
  }, [productos, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Inventario</h1>
          <p className="text-sm text-slate-500">
            Administra los productos disponibles en la zapatería.
          </p>
        </div>
        <button
          onClick={abrirCrear}
          className="inline-flex items-center justify-center rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Agregar producto
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Buscar por nombre, referencia, color o talla"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        {mensaje && (
          <div className="text-xs text-emerald-700">{mensaje}</div>
        )}
        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        {loading ? (
          <div className="p-4 text-sm text-slate-500">
            Cargando inventario...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">
            No hay productos registrados.
          </div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Referencia</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Color</th>
                <th className="px-3 py-2">Talla</th>
                <th className="px-3 py-2">Stock</th>
                <th className="px-3 py-2">Precio</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => {
                const stock = p.cantidad_disponible ?? 0;
                const badgeColor =
                  stock === 0
                    ? "bg-red-100 text-red-700"
                    : stock < 5
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-emerald-100 text-emerald-700";
                return (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-3 py-2 text-xs sm:text-sm">
                      {p.referencia}
                    </td>
                    <td className="px-3 py-2 text-xs sm:text-sm">
                      {p.nombre}
                    </td>
                    <td className="px-3 py-2 text-xs sm:text-sm">
                      {p.color}
                    </td>
                    <td className="px-3 py-2 text-xs sm:text-sm">
                      {p.talla}
                    </td>
                    <td className="px-3 py-2 text-xs sm:text-sm">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${badgeColor}`}
                      >
                        {stock} ud
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs sm:text-sm">
                      {p.precio_unitario
                        ? `$ ${p.precio_unitario.toLocaleString("es-CO")}`
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs sm:text-sm">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => abrirAjusteStock(p)}
                          className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
                        >
                          Ajustar stock
                        </button>
                        <button
                          onClick={() => abrirEditar(p)}
                          className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarProducto(p)}
                          className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-md bg-white p-4 shadow-lg">
            <h2 className="mb-2 text-base font-semibold">
              {editing ? "Editar producto" : "Agregar producto"}
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Completa solo los campos necesarios. Podrás modificarlos después.
            </p>
            <form onSubmit={guardarProducto} className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs">Referencia</label>
                <input
                  required
                  value={form.referencia}
                  onChange={(e) => onChangeForm("referencia", e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs">Nombre</label>
                <input
                  required
                  value={form.nombre}
                  onChange={(e) => onChangeForm("nombre", e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs">Color</label>
                  <input
                    value={form.color}
                    onChange={(e) => onChangeForm("color", e.target.value)}
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs">Talla</label>
                  <input
                    type="number"
                    min="10"
                    max="44"
                    value={form.talla}
                    onChange={(e) => onChangeForm("talla", e.target.value)}
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs">Stock inicial</label>
                  <input
                    type="number"
                    min={0}
                    value={form.cantidad_disponible}
                    onChange={(e) =>
                      onChangeForm("cantidad_disponible", e.target.value)
                    }
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs">Precio unidad</label>
                  <input
                    type="number"
                    min={0}
                    value={form.precio_unitario}
                    onChange={(e) =>
                      onChangeForm("precio_unitario", e.target.value)
                    }
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs">Precio mayorista</label>
                  <input
                    type="number"
                    min={0}
                    value={form.precio_mayorista}
                    onChange={(e) =>
                      onChangeForm("precio_mayorista", e.target.value)
                    }
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-600">{error}</div>
              )}

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
                  className="rounded border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {stockProducto && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-md bg-white p-4 shadow-lg">
            <h2 className="mb-2 text-base font-semibold">Ajustar stock</h2>
            <p className="mb-3 text-xs text-slate-600">
              Producto: <span className="font-medium">{stockProducto.nombre}</span>{" "}
              (stock actual: {stockProducto.cantidad_disponible} ud)
            </p>
            <form onSubmit={guardarAjusteStock} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStockTipo("entrada")}
                  className={`rounded border px-2 py-1.5 text-xs ${
                    stockTipo === "entrada"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setStockTipo("salida")}
                  className={`rounded border px-2 py-1.5 text-xs ${
                    stockTipo === "salida"
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Salida
                </button>
              </div>
              <div>
                <label className="mb-1 block text-xs">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={stockCantidad}
                  onChange={(e) => setStockCantidad(e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Puedes anotar el motivo del ajuste en un cuaderno o Excel si
                necesitas más trazabilidad. En esta primera versión solo se
                actualiza la cantidad disponible.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStockProducto(null)}
                  className="rounded border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={stockGuardando}
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {stockGuardando ? "Guardando..." : "Guardar ajuste"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InventarioPage() {
  return (
    <AuthGuard>
      <InventarioContent />
    </AuthGuard>
  );
}


