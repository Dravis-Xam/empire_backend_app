import { useAuth } from "@/hooks/use-auth";
import { useProducts } from "@/hooks/use-products";
import { useOrders } from "@/hooks/use-orders";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";

export default function DashboardHome() {
  const { user } = useAuth();
  const { products } = useProducts();
  const { orders } = useOrders();

  // Simple stats calculation
  const totalRevenue = orders.reduce((acc, order) => acc + Number(order.total), 0);
  const totalProducts = products.length;
  const lowStockProducts = products.filter(p => p.stock < 10).length;
  const recentOrders = orders.slice(0, 5);

  const chartData = [
    { name: 'Jan', sales: 4000 },
    { name: 'Feb', sales: 3000 },
    { name: 'Mar', sales: 2000 },
    { name: 'Apr', sales: 2780 },
    { name: 'May', sales: 1890 },
    { name: 'Jun', sales: 2390 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Dashboard Overview</h2>
        <p className="text-muted-foreground mt-2">Welcome back, here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Total Revenue" 
          value={`$${totalRevenue.toLocaleString()}`} 
          icon={DollarSign} 
          trend="+12% from last month"
          color="bg-emerald-500"
        />
        <StatsCard 
          title="Total Products" 
          value={totalProducts} 
          icon={Package} 
          trend="+2 new items"
          color="bg-blue-500"
        />
        <StatsCard 
          title="Active Orders" 
          value={orders.filter(o => o.status !== 'delivered').length} 
          icon={ShoppingCart} 
          trend="5 pending processing"
          color="bg-orange-500"
        />
        <StatsCard 
          title="Low Stock" 
          value={lowStockProducts} 
          icon={TrendingUp} 
          trend="Requires attention"
          color="bg-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-border">
          <h3 className="text-lg font-bold mb-6">Revenue Overview</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#F1F5F9' }}
                />
                <Bar dataKey="sales" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-border">
          <h3 className="text-lg font-bold mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {recentOrders.length === 0 ? (
              <p className="text-muted-foreground">No recent activity</p>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    #{order.id}
                  </div>
                  <div>
                    <p className="font-medium">New Order Placed</p>
                    <p className="text-xs text-muted-foreground">${Number(order.total).toFixed(2)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, trend, color }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-border hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold mt-2">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-${color.replace('bg-', '')}`}>
          <Icon className={`w-5 h-5 text-${color.replace('bg-', '')}-600`} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-4 font-medium">{trend}</p>
    </div>
  );
}
