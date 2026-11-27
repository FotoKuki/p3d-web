import { getPrintModel } from "../../../../../lib/account-store";
import { orderViewer } from "../../../../../lib/order-access";

export async function GET(_request, { params }) {
  const viewer = await orderViewer();
  if (!viewer?.admin) return new Response(null, { status: 404 });
  const { id } = await params;
  const model = /^[a-f0-9-]{36}$/.test(id) && (await getPrintModel(id));
  if (!model) return new Response(null, { status: 404 });
  const isArchive = model[0] === 0x50 && model[1] === 0x4b && model[2] === 3 && model[3] === 4;
  return new Response(model, { headers: {
    "Content-Type": isArchive ? "application/zip" : "application/octet-stream",
    "Content-Disposition": 'attachment; filename="p3d-' + id + (isArchive ? '.zip"' : '.stl"'),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}