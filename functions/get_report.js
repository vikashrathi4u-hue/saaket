export async function onRequestPost(context) {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY;
  
  try {
    const { items, brands, startDate, endDate } = await context.request.json();

    // 1. Updated to use 'net_sale_value' as per your SQL
    let salesQuery = `${url}/rest/v1/sales_history?select=bill_no,item_name,brand,net_sale_value`;
    
    if (items && items.length > 0) {
      const itemFilter = items.map(i => `"${encodeURIComponent(i)}"`).join(',');
      salesQuery += `&item_name=in.(${itemFilter})`;
    }
    
    if (brands && brands.length > 0) {
      const brandFilter = brands.map(b => `"${encodeURIComponent(b)}"`).join(',');
      salesQuery += `&brand=in.(${brandFilter})`;
    }
    
    if (startDate) salesQuery += `&bill_date=gte.${startDate}`;
    if (endDate) salesQuery += `&bill_date=lte.${endDate}`;

    const salesRes = await fetch(salesQuery, { headers: { "apikey": key, "Authorization": `Bearer ${key}` } });
    const salesData = await salesRes.json();

    if (!Array.isArray(salesData) || salesData.length === 0) {
      return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
    }

    // 2. Fetching 'gross_total' instead of 'total_amount'[cite: 3]
    const billNos = [...new Set(salesData.map(s => s.bill_no))];
    const billFilter = billNos.map(b => `"${encodeURIComponent(b)}"`).join(',');
    
    const summaryRes = await fetch(`${url}/rest/v1/bill_summaries?bill_no=in.(${billFilter})&select=bill_no,mobile_no,customer_name,gross_total`, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` }
    });
    
    const summaryData = await summaryRes.json();
    if (!Array.isArray(summaryData)) return new Response(JSON.stringify([]));

    const reportMap = {};
    summaryData.forEach(bill => {
      const mobile = bill.mobile_no || "Unknown";
      if (!reportMap[mobile]) {
        reportMap[mobile] = { name: bill.customer_name || "Walk-in", mobile, totalSale: 0, itemSale: 0, brandSale: 0 };
      }
      // Summing 'gross_total'[cite: 3]
      reportMap[mobile].totalSale += parseFloat(bill.gross_total || 0);
    });

    salesData.forEach(sale => {
      const bill = summaryData.find(b => b.bill_no === sale.bill_no);
      if (bill && reportMap[bill.mobile_no]) {
        const cust = reportMap[bill.mobile_no];
        // Summing 'net_sale_value'[cite: 3]
        const val = parseFloat(sale.net_sale_value || 0);
        if (items?.includes(sale.item_name)) cust.itemSale += val;
        if (brands?.includes(sale.brand)) cust.brandSale += val;
      }
    });

    return new Response(JSON.stringify(Object.values(reportMap)), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}