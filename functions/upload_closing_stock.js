export async function onRequestPost(context) {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY;

  try {
    // 1. Get raw request payload from the frontend
    const { category, brand, itemsData } = await context.request.json();

    if (!category || !brand || !Array.isArray(itemsData)) {
      return new Response(JSON.stringify({ error: "Missing required category, brand, or items inventory payload." }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    // Headers used for all Supabase REST API interactions
    const baseHeaders = {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    };

    // ========================================================
    // STEP A: THE PURGE RULE
    // Wipe clean old closing snapshots matching this Category + Brand
    // ========================================================
    const purgeUrl = `${url}/rest/v1/store_closing_stock?category=eq.${encodeURIComponent(category)}&brand=eq.${encodeURIComponent(brand)}`;
    const purgeResponse = await fetch(purgeUrl, {
      method: "DELETE",
      headers: baseHeaders
    });

    if (!purgeResponse.ok) {
      throw new Error(`Failed to clear previous closing stock records from Supabase: ${purgeResponse.statusText}`);
    }

    // ========================================================
    // STEP B: APPLY THE TRUTH HIERARCHY (RRB -> VC -> RRC)
    // Consolidate rows into exactly one record per Clean Code + Color combo
    // ========================================================
    const consolidatedMap = {};
    const sizeRegistrySet = new Set();

    itemsData.forEach((row) => {
      const cleanCode = row.clean_item_code;
      const standardColor = row.color; // Standardized/translated color string
      const store = row.store_code;    // 'RRB', 'VC', or 'RRC'

      if (!cleanCode || !standardColor || !store) return;

      const mapKey = `${cleanCode}|||${standardColor}`;

      // Initialize the map line if it doesn't exist yet
      if (!consolidatedMap[mapKey]) {
        consolidatedMap[mapKey] = {
          category: category,
          brand: brand,
          clean_item_code: cleanCode,
          raw_item_code: row.raw_item_code || cleanCode,
          color: standardColor,
          raw_color: row.raw_color || standardColor,
          rrc_sizes: {},
          vc_sizes: {},
          rrb_sizes: {},
          rrc_total_qty: 0,
          vc_total_qty: 0,
          rrb_total_qty: 0,
          // Temporary object stores tracking raw entry priorities for resolution updates
          _sourceStore: store 
        };
      }

      // Extract the row sizes mapping object (e.g., {"M": 2, "L": 1})
      const sizesObj = row.sizes || {};
      let rowTotalQty = 0;

      Object.keys(sizesObj).forEach((size) => {
        const qty = parseInt(sizesObj[size], 10) || 0;
        if (qty > 0) {
          rowTotalQty += qty;
          sizeRegistrySet.add(size.toUpperCase().trim());
          
          // Map to the correct store block
          if (store === "RRC") consolidatedMap[mapKey].rrc_sizes[size] = qty;
          if (store === "VC")  consolidatedMap[mapKey].vc_sizes[size] = qty;
          if (store === "RRB") consolidatedMap[mapKey].rrb_sizes[size] = qty;
        }
      });

      // Update structural cache counters
      if (store === "RRC") consolidatedMap[mapKey].rrc_total_qty += rowTotalQty;
      if (store === "VC")  consolidatedMap[mapKey].vc_total_qty += rowTotalQty;
      if (store === "RRB") consolidatedMap[mapKey].rrb_total_qty += rowTotalQty;

      // Apply the Hierarchy Rule to prioritize descriptions/raw labels
      // Rules: If an entry comes from RRB, it wins. If current is not RRB but next is VC, VC wins over RRC.
      const existingRecord = consolidatedMap[mapKey];
      if (store === "RRB") {
        existingRecord.raw_item_code = row.raw_item_code || cleanCode;
        existingRecord.raw_color = row.raw_color || standardColor;
        existingRecord._sourceStore = "RRB";
      } else if (store === "VC" && existingRecord._sourceStore !== "RRB") {
        existingRecord.raw_item_code = row.raw_item_code || cleanCode;
        existingRecord.raw_color = row.raw_color || standardColor;
        existingRecord._sourceStore = "VC";
      }
    });

    // Transform mapping dictionary back to an insertable database array
    const recordsToInsert = Object.values(consolidatedMap).map(item => {
      // Clean up internal tracking metadata helper before payload transmission
      delete item._sourceStore;
      return item;
    });

    // ========================================================
    // STEP C: BATCH PERSIST RECORDS TO SUPABASE
    // ========================================================
    if (recordsToInsert.length > 0) {
      const insertUrl = `${url}/rest/v1/store_closing_stock`;
      const insertResponse = await fetch(insertUrl, {
        method: "POST",
        headers: {
          ...baseHeaders,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(recordsToInsert)
      });

      if (!insertResponse.ok) {
        throw new Error(`Failed to save closing rows into Supabase matrix: ${insertResponse.statusText}`);
      }
    }

    // ========================================================
    // STEP D: UPDATE THE DYNAMIC SIZE REGISTRY
    // Upsert sizes present in this upload file context
    // ========================================================
    if (sizeRegistrySet.size > 0) {
      const sizeRecords = Array.from(sizeRegistrySet).map(size => ({
        category: category,
        size_name: size
      }));

      const sizeUrl = `${url}/rest/v1/category_size_registry`;
      await fetch(sizeUrl, {
        method: "POST",
        headers: {
          ...baseHeaders,
          "Prefer": "resolution=merge-duplicates" // Prevent duplicate error codes on existing sizes
        },
        body: JSON.stringify(sizeRecords)
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      rowsProcessed: recordsToInsert.length,
      sizesRegistered: sizeRegistrySet.size
    }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}