export async function onRequestPost(context) {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY;
  
  try {
    const { items, brands, startDate, endDate } = await context.request.json();

    // 1. Fetch filtered sales data
    let salesQuery = `${url}/rest/v1/sales_history?select=bill_no,item_name,brand,sale_value`;
    if (items?.length > 0) salesQuery += `&item_name=in.(${items.map(i => `"${i}"`).join(',')})`;
    if (brands?.length > 0) salesQuery += `&brand=in.(${brands.map(b => `"${b}"`).join(',')})`;
    if (startDate) salesQuery += `&bill_date=gte.${startDate}`;
    if (endDate) salesQuery += `&bill_date=lte.${endDate}`;

    const salesRes = await fetch(salesQuery, { headers: { "apikey": key, "Authorization": `Bearer ${key}` } });
    const salesData = await salesRes.json();

    if (!salesData.length) return new Response(JSON.stringify([]));

    // 2. Get unique Bill IDs to find the customers
    const billNos = [...new Set(salesData.map(s => s.bill_no))];
    const summaryRes = await fetch(`${url}/rest/v1/bill_summaries?bill_no=in.(${billNos.map(b => `"${b}"`).join(',')})&select=bill_no,mobile_no,customer_name,total_amount`, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` }
    });
    const summaryData = await summaryRes.json();

    // 3. Aggregate Data by Mobile Number
    const reportMap = {};

    summaryData.forEach(bill => {
      const mobile = bill.mobile_no;
      if (!mobile) return;

      if (!reportMap[mobile]) {
        reportMap[mobile] = {
          name: bill.customer_name || "Walk-in",
          mobile: mobile,
          totalSale: 0,
          itemSale: 0,
          brandSale: 0
        };
      }
      // total_amount from bill_summaries represents the full bill value[cite: 6]
      reportMap[mobile].totalSale += parseFloat(bill.total_amount || 0);
    });

    salesData.forEach(sale => {
      const billInfo = summaryData.find(b => b.bill_no === sale.bill_no);
      if (!billInfo || !reportMap[billInfo.mobile_no]) return;

      const customer = reportMap[billInfo.mobile_no];
      const val = parseFloat(sale.sale_value || 0);

      // If user filtered by items, this tracks only those items[cite: 6]
      if (items?.includes(sale.item_name)) customer.itemSale += val;
      // If user filtered by brands, this tracks only those brands[cite: 6]
      if (brands?.includes(sale.brand)) customer.brandSale += val;
    });

    return new Response(JSON.stringify(Object.values(reportMap)), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}