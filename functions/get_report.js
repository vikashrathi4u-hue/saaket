export async function onRequestPost(context) {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY;
  
  try {
    const { items, brands, startDate, endDate } = await context.request.json();

    // 1. Build the Sales History Query
    let salesQuery = `${url}/rest/v1/sales_history?select=bill_no,item_name,brand,sale_value`;
    
    // Fix: Properly format the "in" filter for Supabase
    if (items && items.length > 0) {
      const itemFilter = items.map(i => `"${i}"`).join(',');
      salesQuery += `&item_name=in.(${itemFilter})`;
    }
    
    if (brands && brands.length > 0) {
      const brandFilter = brands.map(b => `"${b}"`).join(',');
      salesQuery += `&brand=in.(${brandFilter})`;
    }
    
    if (startDate) salesQuery += `&bill_date=gte.${startDate}`;
    if (endDate) salesQuery += `&bill_date=lte.${endDate}`;

    const salesRes = await fetch(salesQuery, { 
      headers: { "apikey": key, "Authorization": `Bearer ${key}` } 
    });
    
    const salesData = await salesRes.json();

    // If no sales found, stop early
    if (!salesData || salesData.length === 0) {
      return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
    }

    // 2. Fetch Customer Details for these specific bills
    const billNos = [...new Set(salesData.map(s => s.bill_no))];
    // Chunking might be needed if billNos > 100, but starting with standard filter:
    const billFilter = billNos.map(b => `"${b}"`).join(',');
    
    const summaryRes = await fetch(`${url}/rest/v1/bill_summaries?bill_no=in.(${billFilter})&select=bill_no,mobile_no,customer_name,total_amount`, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` }
    });
    const summaryData = await summaryRes.json();

    // 3. Process and Aggregate
    const reportMap = {};

    summaryData.forEach(bill => {
      const mobile = bill.mobile_no || "Unknown";
      if (!reportMap[mobile]) {
        reportMap[mobile] = { 
          name: bill.customer_name || "Walk-in", 
          mobile: mobile, 
          totalSale: 0, 
          itemSale: 0, 
          brandSale: 0 
        };
      }
      reportMap[mobile].totalSale += parseFloat(bill.total_amount || 0);
    });

    salesData.forEach(sale => {
      const bill = summaryData.find(b => b.bill_no === sale.bill_no);
      if (bill && reportMap[bill.mobile_no]) {
        const cust = reportMap[bill.mobile_no];
        const val = parseFloat(sale.sale_value || 0);
        
        // Only add to these columns if they were part of the user's filter
        if (items?.includes(sale.item_name)) cust.itemSale += val;
        if (brands?.includes(sale.brand)) cust.brandSale += val;
      }
    });

    return new Response(JSON.stringify(Object.values(reportMap)), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}