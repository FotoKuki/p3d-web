import { getPrintPaymentSlip } from "../../../../../lib/account-store";
import { orderViewer } from "../../../../../lib/order-access";

export async function GET(_request, { params }) {
  if (!(await orderViewer())?.admin) return new Response(null, { status: 404 });
  const { id } = await params;
  const slip = await getPrintPaymentSlip(id);
  if (!slip) return new Response(null, { status: 404 });
  return new Response(slip.image, { headers: {
    "Content-Type": slip.mime,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  } });
}
