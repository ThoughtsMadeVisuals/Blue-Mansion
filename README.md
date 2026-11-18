# The Blue Mansion · POS Sales Analytics

A local dashboard for Odoo POS order exports. Everything runs in your browser on your own computer; no sales data is uploaded anywhere.

## Start the app

- **Mac:** double-click `Open_POS_Report.command`
- **Windows:** double-click `Start_POS_Report_Windows.bat`

The first start installs and builds the app. After you update the app (e.g. `git pull`), the launcher rebuilds automatically.

Drag one or more Odoo exports (`.xlsx` or `.csv`) into the page. You can add files for different years or months; orders that are already loaded are skipped. Data stays saved in the browser until you press the bin icon.

## What to export from Odoo

Point of Sale → Orders → select orders → Export, with these fields:

| Field | Used for |
|---|---|
| Order Ref, Receipt Number | Counting each receipt (transaction) once |
| Date | Daily, monthly and hourly charts |
| Point of Sale | Outlets (Mangga, The Bar, Indigo Restaurant, Gift Shop, …) |
| Status | Leaving out Cancelled and unpaid (New) orders |
| Guests | Amount of guests, spend per guest |
| Total | Detecting refunds |
| Order Lines/Product, Order Lines/Quantity | Items sold |
| Order Lines/Tax Excl., Order Lines/Tax Incl. | Sales (switch Excl./Incl. tax in the header) |
| Order Lines/Product/Point of Sale Category | Sales by category |
| Order Lines/Product/Product Category | Food vs beverage |

If a file has no category columns, items get the category of the same item in another loaded file where possible.

## Sections

- **Overview:** key figures with change against the same dates last year, best month/day/weekday/hour, outlet comparison, top 5 food and beverages.
- **Monthly & Year vs Year:** each month of every year side by side, monthly trend by outlet, monthly figures table. A warning appears (with a one-click fix) when the years contain different outlets.
- **Daily & Festive Days:** daily sales with last year's line overlaid, best and weakest days, average by weekday, and holiday/festive day performance against normal days.
- **Best Hours:** best hour per outlet, sales by hour, weekday × hour heatmap.
- **Items:** most sold food and beverages, full sales-by-item table, and a trend for any item.
- **Categories:** food vs beverage by outlet, sales by POS category or product category.
- **Guests & Tickets:** tickets, average ticket, guests and spend per guest for every outlet, daily, weekly or monthly.

Settings lets you regroup points of sale into outlets, override food/beverage for a category, and edit the holiday list (Malaysia/Penang 2025–2026 is included; check the Islamic holiday dates).

## Development

```bash
npm install
npm run dev     # local dev server
npm test        # unit tests
npm run build   # production build into dist/
```
