export async function onRequestPost(context) {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY;

  try {
    // 1. Parse chosen parameters from the frontend request
    const { category, brand } = await context.request.json();

    if (!category) {
      return new Response(JSON.stringify({ error: "Missing required category parameter." }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const baseHeaders = {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    };

    // ========================================================
    // STEP A: FETCH THE DYNAMIC SIZES FOR THIS CATEGORY
    // ========================================================
    const sizeUrl = `${url}/rest/v1/category_size_registry?category=eq.${encodeURIComponent(category)}&select=size_name`;
    const sizeResponse = await fetch(sizeUrl, { headers: baseHeaders });
    
    if (!sizeResponse.ok) {
      throw new Error(`Failed to read size list from registry: ${sizeResponse.statusText}`);
    }
    const sizeData = await sizeResponse.json();
    // Transform into a clean, uppercase sorted array (e.g., ['M', 'L', 'XL'])
    const activeSizes = sizeData.map(s => s.size_name.toUpperCase().trim()).sort();

    // ========================================================
    // STEP B: BUILD THE DYNAMIC STOCK MATRIX QUERY
    // ========================================================
    // ========================================================
    // STEP B: BUILD THE DYNAMIC STOCK MATRIX QUERY
    // ========================================================
    let stockUrl = `${url}/rest/v1/store_closing_stock?category=eq.${encodeURIComponent(category)}`;
    if (brand && brand !== "ALL_BRANDS") {
      stockUrl += `&brand=eq.${encodeURIComponent(brand)}`;
    }
    stockUrl += `&order=clean_item_code.asc,color.asc`;

    const stockResponse = await fetch(stockUrl, { headers: baseHeaders });
    if (!stockResponse.ok) {
      throw new Error(`Failed to read snapshot matrices from Supabase: ${stockResponse.statusText}`);
    }
    const matrixRows = await stockResponse.json();

    // Calculate the latest uploaded timestamp for each store in this context slice
    const timestamps = { RRC: "Never", VC: "Never", RRB: "Never" };
    
    matrixRows.forEach(row => {
      if (row.updated_at) {
        const rowTime = new Date(row.updated_at);
        // If the store actually holds quantities on this matching index slice line
        if (row.rrc_total_qty > 0 && (timestamps.RRC === "Never" || rowTime > new Date(timestamps.RRC))) {
          timestamps.RRC = row.updated_at;
        }
        if (row.vc_total_qty > 0 && (timestamps.VC === "Never" || rowTime > new Date(timestamps.VC))) {
          timestamps.VC = row.updated_at;
        }
        if (row.rrb_total_qty > 0 && (timestamps.RRB === "Never" || rowTime > new Date(timestamps.RRB))) {
          timestamps.RRB = row.updated_at;
        }
      }
    });

    // ========================================================
    // STEP C: RETURN COMBINED STRUCTURAL PAYLOAD WITH TIMESTAMPS
    // ========================================================
    return new Response(JSON.stringify({
      success: true,
      sizes: activeSizes,
      matrix: matrixRows,
      timestamps: timestamps
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}