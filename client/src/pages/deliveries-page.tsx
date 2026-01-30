import { useDeliveries } from "@/hooks/use-deliveries";
import { useAuth } from "@/hooks/use-auth";
import { StatusBadge } from "@/components/status-badge";
import { Loader2, MapPin } from "lucide-react";

export default function DeliveriesPage() {
  const { deliveries, updateDelivery, isLoading } = useDeliveries();
  const { user } = useAuth();

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold">Logistics & Delivery</h2>
        <p className="text-muted-foreground mt-1">Manage fleet and delivery statuses.</p>
      </div>

      <div className="grid gap-4">
        {deliveries.map((delivery) => (
          <div key={delivery.id} className="bg-white p-6 rounded-2xl shadow-sm border border-border flex flex-col md:flex-row justify-between gap-6">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg">Delivery #{delivery.id}</h3>
                  <StatusBadge status={delivery.status} />
                </div>
                <p className="text-sm text-muted-foreground mt-1">Order ID: {delivery.orderId}</p>
                <div className="mt-2 text-sm bg-slate-50 p-2 rounded-lg border border-slate-100 inline-block">
                  Tracking: {delivery.trackingInfo || "Not assigned"}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 justify-center w-full md:w-auto">
              {['admin', 'delivery_crew'].includes(user?.role || '') && (
                <>
                  <input 
                    placeholder="Update tracking info..."
                    className="px-3 py-2 border rounded-lg text-sm w-full md:w-64"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateDelivery({ id: delivery.id, trackingInfo: e.currentTarget.value });
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => updateDelivery({ id: delivery.id, status: 'out_for_delivery' })}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100"
                    >
                      Start Delivery
                    </button>
                    <button 
                      onClick={() => updateDelivery({ id: delivery.id, status: 'delivered' })}
                      className="flex-1 px-3 py-2 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-100"
                    >
                      Complete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        {deliveries.length === 0 && (
           <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <p className="text-muted-foreground">No active deliveries.</p>
          </div>
        )}
      </div>
    </div>
  );
}
