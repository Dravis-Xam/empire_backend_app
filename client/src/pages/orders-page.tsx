import { useOrders } from "@/hooks/use-orders";
import { useProducts } from "@/hooks/use-products";
import { useAuth } from "@/hooks/use-auth";
import { StatusBadge } from "@/components/status-badge";
import { Loader2, Package } from "lucide-react";

export default function OrdersPage() {
  const { orders, updateStatus, createOrder, isLoading } = useOrders();
  const { products } = useProducts();
  const { user } = useAuth();
  
  // For clients to create order (simple version)
  const handleCreateTestOrder = () => {
    if (!products.length) return alert("No products available");
    const product = products[0];
    createOrder({
      userId: user?.id || 0,
      status: "pending",
      total: product.price,
      items: [{ productId: product.id, quantity: 1, price: Number(product.price) }]
    });
  };

  const nextStatus = (current: string) => {
    const flow = ['pending', 'processing', 'shipped', 'delivered'];
    const idx = flow.indexOf(current);
    if (idx < flow.length - 1) return flow[idx + 1];
    return null;
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-display font-bold">Orders Management</h2>
          <p className="text-muted-foreground mt-1">Track and process customer orders.</p>
        </div>
        {user?.role === 'client' && (
          <button 
            onClick={handleCreateTestOrder}
            className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            Place Test Order
          </button>
        )}
      </div>

      <div className="grid gap-6">
        {orders.map((order) => (
          <div key={order.id} className="bg-white p-6 rounded-2xl shadow-sm border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg">Order #{order.id}</h3>
                  <StatusBadge status={order.status} />
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  Placed on {new Date(order.createdAt).toLocaleDateString()} • {user?.role === 'admin' ? `User ID: ${order.userId}` : 'My Order'}
                </p>
                <div className="mt-2 text-sm font-medium">
                  Total: ${Number(order.total).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              {['admin', 'customer_care'].includes(user?.role || '') && order.status !== 'delivered' && (
                <button
                  onClick={() => updateStatus({ id: order.id, status: nextStatus(order.status) || 'delivered' })}
                  className="px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors w-full md:w-auto"
                >
                  Mark as {nextStatus(order.status)?.replace('_', ' ')}
                </button>
              )}
              {['admin', 'customer_care'].includes(user?.role || '') && order.status !== 'cancelled' && (
                 <button
                 onClick={() => updateStatus({ id: order.id, status: 'cancelled' })}
                 className="px-4 py-2 text-sm font-medium text-destructive hover:bg-red-50 rounded-lg transition-colors w-full md:w-auto"
               >
                 Cancel Order
               </button>
              )}
            </div>
          </div>
        ))}
        
        {orders.length === 0 && (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <p className="text-muted-foreground">No orders found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
