import { getPrintModel, getPrintOrder } from "../../../../lib/account-store";
import { orderViewer } from "../../../../lib/order-access";

export async function GET(_request, { params }) {
  const viewer = await orderViewer();
  if (!viewer) return new Response(null, { status: 404 });
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const order = await getPrintOrder(id, viewer);
  if (!order) return new Response(null, { status: 404 });
  const model = await getPrintModel(id);
  if (!model) return new Response(null, { status: 404 });

  return new Response(model, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
