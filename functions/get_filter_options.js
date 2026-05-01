export async function onRequest(context) {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY;

  try {
    // We use 'select' with 'distinct' logic by grouping or unique selection
    const [itemsRes, brandsRes] = await Promise.all([
      fetch(`${url}/rest/v1/sales_history?select=item_name`, {
        headers: { "apikey": key, "Authorization": `Bearer ${key}` }
      }),
      fetch(`${url}/rest/v1/sales_history?select=brand`, {
        headers: { "apikey": key, "Authorization": `Bearer ${key}` }
      })
    ]);

    const itemsData = await itemsRes.json();
    const brandsData = await brandsRes.json();

    // Filter for unique values only
    const uniqueItems = [...new Set(itemsData.map(i => i.item_name))].sort();
    const uniqueBrands = [...new Set(brandsData.map(b => b.brand))].sort();

    return new Response(JSON.stringify({ 
      items: uniqueItems, 
      brands: uniqueBrands 
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}