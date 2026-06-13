export async function onRequest(context) {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY;
  const baseHeaders = {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json"
  };

  // GET Request: Fetch all categories and mapped brands
  if (context.request.method === "GET") {
    try {
      const fetchUrl = `${url}/rest/v1/brand_category_directory?select=category,brand&order=category.asc,brand.asc`;
      const res = await fetch(fetchUrl, { headers: baseHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // POST Request: Add new category or associate a new brand
  if (context.request.method === "POST") {
    try {
      const { category, brand } = await context.request.json();
      if (!category || !brand) {
        return new Response(JSON.stringify({ error: "Category and Brand parameters are required." }), { status: 400 });
      }

      const insertUrl = `${url}/rest/v1/brand_category_directory`;
      const response = await fetch(insertUrl, {
        method: "POST",
        headers: { ...baseHeaders, "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify({ 
          category: String(category).toUpperCase().trim(), 
          brand: String(brand).toUpperCase().trim() 
        })
      });

      if (!response.ok) throw new Error("Database insertion conflict or restriction failure.");
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}