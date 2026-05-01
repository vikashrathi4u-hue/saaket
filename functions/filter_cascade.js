export async function onRequestPost(context) {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY;

  try {
    const { items, brand, source } = await context.request.json();
    let query = `${url}/rest/v1/sales_history?select=item_name,brand`;

    if (source === 'item' && items.length > 0) {
      query += `&item_name=in.(${items.map(i => `"${i}"`).join(',')})`;
    } else if (source === 'brand' && brand) {
      query += `&brand=eq."${brand}"`;
    }

    const res = await fetch(query, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` }
    });
    const data = await res.json();

    return new Response(JSON.stringify({
      items: [...new Set(data.map(d => d.item_name))].sort(),
      brands: [...new Set(data.map(d => d.brand))].sort()
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}