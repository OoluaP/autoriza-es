import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  LogOut, 
  Package, 
  FileText, 
  User as UserIcon,
  ChevronRight,
  Info
} from "lucide-react";

// Types
interface Product {
  id: number;
  name: string;
  cost_per_unit: number;
  min_price: number;
}

interface User {
  id: number;
  username: string;
  role: "admin" | "seller";
  password?: string;
}

interface OrderItem {
  product_id: number;
  product_name?: string;
  quantity: number;
  requested_price: number;
}

interface Order {
  id: number;
  client_name: string;
  distance: number;
  term_months: number;
  observations: string;
  total_requested: number;
  min_required: number;
  status: "pending" | "approved" | "rejected";
  seller_name: string;
  nf_number?: string;
  correction_status?: "requested" | "corrected";
  corrected_commission?: number;
  created_at: string;
  items: {
    product_name: string;
    quantity: number;
    requested_price: number;
  }[];
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<"login" | "dashboard" | "products" | "new_order" | "users">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Login State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Products State
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ name: "", cost_per_unit: 0, min_price: 0 });

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ username: "", password: "", role: "seller" as "admin" | "seller" });

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderForm, setOrderForm] = useState({ client_name: "", distance: 0, term_months: 0, observations: "" });
  const [newItem, setNewItem] = useState({ product_id: 0, quantity: 0, requested_price: 0 });

  // Correction Modal State
  const [correctionModal, setCorrectionModal] = useState<{ orderId: number; type: "request" | "submit" } | null>(null);
  const [nfNumber, setNfNumber] = useState("");
  const [correctedCommission, setCorrectedCommission] = useState(0);

  useEffect(() => {
    if (user) {
      fetchProducts();
      fetchOrders();
      if (user.role === "admin") fetchUsers();
    }
  }, [user]);

  const fetchProducts = async () => {
    const res = await fetch("/api/products");
    const data = await res.json();
    setProducts(data);
  };

  const fetchOrders = async () => {
    const url = user?.role === "seller" 
      ? `/api/orders?seller_id=${user.id}&role=seller` 
      : "/api/orders";
    const res = await fetch(url);
    const data = await res.json();
    setOrders(data);
  };

  const fetchUsers = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setView("dashboard");
      } else {
        const err = await res.json();
        setMessage({ text: err.error, type: "error" });
      }
    } catch (err) {
      setMessage({ text: "Erro ao conectar ao servidor", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView("login");
    setUsername("");
    setPassword("");
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingProduct ? "PUT" : "POST";
    const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
    
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productForm),
    });
    
    setEditingProduct(null);
    setProductForm({ name: "", cost_per_unit: 0, min_price: 0 });
    fetchProducts();
    setMessage({ text: "Produto salvo com sucesso", type: "success" });
  };

  const handleAddOrderItem = () => {
    if (newItem.product_id === 0 || newItem.quantity <= 0 || newItem.requested_price <= 0) return;
    
    const product = products.find(p => p.id === newItem.product_id);
    setOrderItems([...orderItems, { ...newItem, product_name: product?.name }]);
    setNewItem({ product_id: 0, quantity: 0, requested_price: 0 });
  };

  const handleRemoveOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleSubmitOrder = async () => {
    if (orderItems.length === 0 || !orderForm.client_name) {
      setMessage({ text: "Preencha todos os campos obrigatórios", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...orderForm,
          items: orderItems,
          seller_id: user?.id
        }),
      });
      
      const data = await res.json();
      setMessage({ 
        text: data.status === "approved" ? "Pedido aprovado automaticamente!" : "Pedido enviado para análise do administrador.",
        type: "success" 
      });
      
      setOrderItems([]);
      setOrderForm({ client_name: "", distance: 0, term_months: 0, observations: "" });
      setView("dashboard");
      fetchOrders();
    } catch (err) {
      setMessage({ text: "Erro ao enviar pedido", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (id: number, status: string) => {
    await fetch(`/api/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchOrders();
    setMessage({ text: `Pedido ${status === "approved" ? "aprovado" : "reprovado"}`, type: "success" });
  };

  const handleRequestCorrection = async () => {
    if (!correctionModal || !nfNumber) return;
    await fetch(`/api/orders/${correctionModal.orderId}/request-correction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nf_number: nfNumber }),
    });
    setCorrectionModal(null);
    setNfNumber("");
    fetchOrders();
    setMessage({ text: "Solicitação de correção enviada", type: "success" });
  };

  const handleSubmitCorrection = async () => {
    if (!correctionModal || correctedCommission <= 0) return;
    await fetch(`/api/orders/${correctionModal.orderId}/submit-correction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ corrected_commission: correctedCommission }),
    });
    setCorrectionModal(null);
    setCorrectedCommission(0);
    fetchOrders();
    setMessage({ text: "Comissão corrigida com sucesso", type: "success" });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingUser ? "PUT" : "POST";
    const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
    
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });
    
    if (res.ok) {
      setEditingUser(null);
      setUserForm({ username: "", password: "", role: "seller" });
      fetchUsers();
      setMessage({ text: "Usuário salvo com sucesso", type: "success" });
    } else {
      const err = await res.json();
      setMessage({ text: err.error, type: "error" });
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir este usuário?")) {
      await fetch(`/api/users/${id}`, { method: "DELETE" });
      fetchUsers();
      setMessage({ text: "Usuário excluído", type: "success" });
    }
  };

  // Renderers
  if (view === "login") {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-stone-200">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-emerald-800 tracking-tight">AGROZOO</h1>
            <p className="text-stone-500 mt-2 italic">Autorização de Preços</p>
          </div>
          
          {message && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">Usuário</label>
              <input 
                type="text" 
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">Senha</label>
              <input 
                type="password" 
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-700/20 transition-all disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-700 rounded-lg flex items-center justify-center text-white font-bold">A</div>
            <span className="font-bold text-xl tracking-tight text-emerald-900">AGROZOO</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-sm font-bold text-stone-800">{user?.username}</span>
              <span className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">{user?.role === "admin" ? "Administrador" : "Vendedor"}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 bg-stone-200/50 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setView("dashboard")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${view === "dashboard" ? "bg-white text-emerald-800 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}
          >
            <FileText size={16} /> Pedidos
          </button>
          {user?.role === "admin" && (
            <>
              <button 
                onClick={() => setView("products")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${view === "products" ? "bg-white text-emerald-800 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}
              >
                <Package size={16} /> Produtos
              </button>
              <button 
                onClick={() => setView("users")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${view === "users" ? "bg-white text-emerald-800 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}
              >
                <UserIcon size={16} /> Usuários
              </button>
            </>
          )}
          {user?.role === "seller" && (
            <button 
              onClick={() => setView("new_order")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${view === "new_order" ? "bg-white text-emerald-800 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}
            >
              <Plus size={16} /> Novo Pedido
            </button>
          )}
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center justify-between ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
            <span className="text-sm font-medium">{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100">Fechar</button>
          </div>
        )}

        {/* Views */}
        {view === "dashboard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-stone-800">
                {user?.role === "admin" ? "Lista de Pedidos" : "Meus Pedidos"}
              </h2>
              {user?.role === "seller" && (
                <button onClick={() => setView("new_order")} className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-800 transition-all">
                  <Plus size={18} /> Criar Pedido
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Cliente</th>
                      {user?.role === "admin" && <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Vendedor</th>}
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Total Solicitado</th>
                      {user?.role === "admin" && <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Mín. Necessário</th>}
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Dist/Prazo</th>
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Status</th>
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={user?.role === "admin" ? 7 : 5} className="p-8 text-center text-stone-400 italic">Nenhum pedido encontrado</td>
                      </tr>
                    ) : (
                      orders.map(order => (
                        <tr key={order.id} className="hover:bg-stone-50/50 transition-colors border-b border-stone-100 last:border-0">
                          <td className="p-4 align-top">
                            <div className="font-bold text-stone-800">{order.client_name}</div>
                            <div className="text-[10px] text-stone-400 mb-2">{new Date(order.created_at).toLocaleDateString()}</div>
                            
                            {/* Items List */}
                            <div className="bg-stone-50 rounded-lg p-2 border border-stone-100">
                              <div className="text-[9px] uppercase tracking-widest text-stone-400 font-bold mb-1">Itens:</div>
                              <ul className="space-y-1">
                                {order.items?.map((item, i) => (
                                  <li key={i} className="text-[10px] text-stone-600 flex justify-between gap-4">
                                    <span>{item.quantity}x {item.product_name}</span>
                                    <span className="font-mono font-semibold">R$ {item.requested_price.toFixed(2)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </td>
                          {user?.role === "admin" && <td className="p-4 text-sm text-stone-600 align-top">{order.seller_name}</td>}
                          <td className="p-4 font-mono font-bold text-emerald-700 align-top">R$ {order.total_requested.toFixed(2)}</td>
                          {user?.role === "admin" && <td className="p-4 font-mono text-stone-500 align-top">R$ {order.min_required.toFixed(2)}</td>}
                          <td className="p-4 text-xs text-stone-600 align-top">
                            {order.distance}km / {order.term_months}m
                          </td>
                          <td className="p-4 align-top">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              order.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                              order.status === "rejected" ? "bg-red-100 text-red-700" :
                              "bg-amber-100 text-amber-700"
                            }`}>
                              {order.status === "approved" ? "Aprovado" : order.status === "rejected" ? "Reprovado" : "Pendente"}
                            </span>

                            {order.correction_status && (
                              <div className={`mt-2 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                                order.correction_status === "requested" ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-blue-50 text-blue-600 border-blue-100"
                              }`}>
                                {order.correction_status === "requested" ? "Correção Solicitada" : "Comissão Corrigida"}
                                {order.corrected_commission && (
                                  <div className="mt-0.5 text-stone-800">R$ {order.corrected_commission.toFixed(2)}</div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-right align-top">
                            <div className="flex flex-col gap-2 items-end">
                              {user?.role === "admin" && order.status === "pending" && (
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => handleUpdateOrderStatus(order.id, "approved")}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                    title="Aprovar"
                                  >
                                    <CheckCircle size={18} />
                                  </button>
                                  <button 
                                    onClick={() => handleUpdateOrderStatus(order.id, "rejected")}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    title="Reprovar"
                                  >
                                    <XCircle size={18} />
                                  </button>
                                </div>
                              )}

                              {user?.role === "seller" && order.status === "approved" && !order.correction_status && (
                                <button 
                                  onClick={() => setCorrectionModal({ orderId: order.id, type: "request" })}
                                  className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 hover:underline"
                                >
                                  Solicitar Correção
                                </button>
                              )}

                              {user?.role === "admin" && order.correction_status === "requested" && (
                                <div className="flex flex-col items-end gap-1">
                                  <div className="text-[10px] text-stone-500 font-semibold">NF: {order.nf_number}</div>
                                  <button 
                                    onClick={() => setCorrectionModal({ orderId: order.id, type: "submit" })}
                                    className="bg-emerald-700 text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-800"
                                  >
                                    Corrigir Comissão
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === "products" && user?.role === "admin" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Product Form */}
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm sticky top-24">
                <h3 className="text-lg font-bold text-stone-800 mb-6 flex items-center gap-2">
                  {editingProduct ? "Editar Produto" : "Novo Produto"}
                </h3>
                <form onSubmit={handleSaveProduct} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Nome do Produto</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Custo/Unid</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={isNaN(productForm.cost_per_unit) ? "" : productForm.cost_per_unit}
                        onChange={(e) => setProductForm({ ...productForm, cost_per_unit: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Preço Mín.</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-700"
                        value={isNaN(productForm.min_price) ? "" : productForm.min_price}
                        onChange={(e) => setProductForm({ ...productForm, min_price: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 bg-emerald-700 text-white font-bold py-3 rounded-xl hover:bg-emerald-800 transition-all">
                      Salvar
                    </button>
                    {editingProduct && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingProduct(null);
                          setProductForm({ name: "", cost_per_unit: 0, min_price: 0 });
                        }}
                        className="px-4 bg-stone-100 text-stone-600 font-bold rounded-xl hover:bg-stone-200 transition-all"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* Product List */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Produto</th>
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Custo</th>
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Preço Mín.</th>
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {products.map(product => (
                      <tr key={product.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="p-4 font-bold text-stone-800">{product.name}</td>
                        <td className="p-4 font-mono text-stone-500">R$ {product.cost_per_unit.toFixed(2)}</td>
                        <td className="p-4 font-mono font-bold text-emerald-700">R$ {product.min_price.toFixed(2)}</td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => {
                              setEditingProduct(product);
                              setProductForm({ name: product.name, cost_per_unit: product.cost_per_unit, min_price: product.min_price });
                            }}
                            className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          >
                            <FileText size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === "users" && user?.role === "admin" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* User Form */}
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm sticky top-24">
                <h3 className="text-lg font-bold text-stone-800 mb-6 flex items-center gap-2">
                  <UserIcon size={20} className="text-emerald-600" />
                  {editingUser ? "Editar Usuário" : "Novo Usuário"}
                </h3>
                <form onSubmit={handleSaveUser} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Nome de Usuário</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={userForm.username}
                      onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Senha {editingUser && "(deixe vazio para manter)"}</label>
                    <input 
                      type="password" 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      required={!editingUser}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Autorização</label>
                    <select 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                      required
                    >
                      <option value="seller">Vendedor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 bg-emerald-700 text-white font-bold py-3 rounded-xl hover:bg-emerald-800 transition-all">
                      Salvar
                    </button>
                    {editingUser && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingUser(null);
                          setUserForm({ username: "", password: "", role: "seller" });
                        }}
                        className="px-4 bg-stone-100 text-stone-600 font-bold rounded-xl hover:bg-stone-200 transition-all"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* Users List */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Usuário</th>
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Papel</th>
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="p-4 font-bold text-stone-800">{u.username}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {u.role === "admin" ? "Admin" : "Vendedor"}
                          </span>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setEditingUser(u);
                              setUserForm({ username: u.username, password: "", role: u.role });
                            }}
                            className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          >
                            <FileText size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === "new_order" && user?.role === "seller" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Order Details */}
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4 sticky top-24">
                <h3 className="text-lg font-bold text-stone-800 mb-4">Dados do Pedido</h3>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Cliente</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={orderForm.client_name}
                    onChange={(e) => setOrderForm({ ...orderForm, client_name: e.target.value })}
                    placeholder="Nome do Cliente"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Distância (km)</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={isNaN(orderForm.distance) ? "" : orderForm.distance}
                      onChange={(e) => setOrderForm({ ...orderForm, distance: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Prazo (meses)</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={isNaN(orderForm.term_months) ? "" : orderForm.term_months}
                      onChange={(e) => setOrderForm({ ...orderForm, term_months: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Observações</label>
                  <textarea 
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none"
                    value={orderForm.observations}
                    onChange={(e) => setOrderForm({ ...orderForm, observations: e.target.value })}
                  />
                </div>
                
                <div className="pt-4 border-t border-stone-100">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-semibold text-stone-500">Total Solicitado:</span>
                    <span className="text-xl font-bold text-emerald-800 font-mono">
                      R$ {orderItems.reduce((sum, item) => sum + (item.quantity * item.requested_price), 0).toFixed(2)}
                    </span>
                  </div>
                  <button 
                    onClick={handleSubmitOrder}
                    disabled={loading || orderItems.length === 0}
                    className="w-full bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-700/20 hover:bg-emerald-800 transition-all disabled:opacity-50"
                  >
                    {loading ? "Processando..." : "Enviar para Autorização"}
                  </button>
                </div>
              </div>
            </div>

            {/* Items Area */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                <h3 className="text-lg font-bold text-stone-800 mb-6 flex items-center gap-2">
                  <Plus size={20} className="text-emerald-600" /> Adicionar Itens
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Produto</label>
                    <select 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={newItem.product_id}
                      onChange={(e) => setNewItem({ ...newItem, product_id: parseInt(e.target.value) })}
                    >
                      <option value={0}>Selecione um produto</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Qtd</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={isNaN(newItem.quantity) ? "" : newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Preço Solicitado</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={isNaN(newItem.requested_price) ? "" : newItem.requested_price}
                      onChange={(e) => setNewItem({ ...newItem, requested_price: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleAddOrderItem}
                  className="mt-4 w-full sm:w-auto px-6 py-3 bg-stone-100 text-stone-800 font-bold rounded-xl hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Adicionar ao Pedido
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Produto</th>
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Qtd</th>
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Preço Unit.</th>
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Subtotal</th>
                      <th className="p-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {orderItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-stone-400 italic">Nenhum item adicionado</td>
                      </tr>
                    ) : (
                      orderItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-stone-50/50 transition-colors">
                          <td className="p-4 font-bold text-stone-800">{item.product_name}</td>
                          <td className="p-4 text-sm text-stone-600">{item.quantity}</td>
                          <td className="p-4 font-mono text-stone-500">R$ {item.requested_price.toFixed(2)}</td>
                          <td className="p-4 font-mono font-bold text-emerald-700">R$ {(item.quantity * item.requested_price).toFixed(2)}</td>
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => handleRemoveOrderItem(idx)}
                              className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-start gap-3">
                <Info size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-800 leading-relaxed">
                  <p className="font-bold mb-1 uppercase tracking-wider">Regra de Aprovação:</p>
                  <p>O pedido será aprovado automaticamente se o valor total solicitado cobrir o custo mínimo ajustado pelo prazo (1,5%/mês) e pela distância (R$ 14,00/km).</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>

      {/* Correction Modal */}
      {correctionModal && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-sm border border-stone-200">
            <h3 className="text-lg font-bold text-stone-800 mb-4">
              {correctionModal.type === "request" ? "Solicitar Correção de Comissão" : "Corrigir Comissão"}
            </h3>
            
            {correctionModal.type === "request" ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Número da Nota Fiscal (NF)</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={nfNumber}
                    onChange={(e) => setNfNumber(e.target.value)}
                    placeholder="Ex: 123456"
                  />
                </div>
                <button 
                  onClick={handleRequestCorrection}
                  className="w-full bg-emerald-700 text-white font-bold py-3 rounded-xl hover:bg-emerald-800 transition-all"
                >
                  Enviar Solicitação
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Valor da Comissão Corrigida (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={correctedCommission === 0 ? "" : correctedCommission}
                    onChange={(e) => setCorrectedCommission(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                <button 
                  onClick={handleSubmitCorrection}
                  className="w-full bg-emerald-700 text-white font-bold py-3 rounded-xl hover:bg-emerald-800 transition-all"
                >
                  Confirmar Correção
                </button>
              </div>
            )}
            
            <button 
              onClick={() => {
                setCorrectionModal(null);
                setNfNumber("");
                setCorrectedCommission(0);
              }}
              className="w-full mt-2 text-stone-400 text-xs font-bold uppercase tracking-widest hover:text-stone-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
