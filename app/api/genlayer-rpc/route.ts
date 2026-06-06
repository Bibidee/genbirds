export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_RPC = process.env.GENLAYER_RPC_URL;

export async function POST(req: Request) {
  try {
    if (!UPSTREAM_RPC) {
      return Response.json(
        { error: "GENLAYER_RPC_URL is not configured" },
        { status: 500 },
      );
    }

    const body = await req.text();

    const upstream = await fetch(UPSTREAM_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
    });

    const text = await upstream.text();

    return new Response(text, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error("[genlayer-rpc-proxy] failed", err);
    return Response.json(
      {
        error: "GenLayer RPC proxy failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
