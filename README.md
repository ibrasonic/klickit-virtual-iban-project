# Klickit Virtual IBAN — Sprint 1 Demo

This full-stack demo presents the school finance interface planned for Sprint 1. It uses a React frontend and an Express API with in-memory demo data. No request is sent to a bank or a production payment provider.

## Run the demo

1. Double-click `run_app.py`, or run `python run_app.py` from PowerShell.
2. Wait for the browser to open automatically.

The launcher installs dependencies automatically if they are missing. You can also start the application manually with `npm run dev`.

The frontend runs on port 5173 and the local API runs on port 3001.

## Sign in

- Username: `finance`
- Password: `finance`

## Recommended demonstration sequence

1. Sign in and review the collection dashboard.
2. Open **Import students** and download the Excel template.
3. Upload `Sprint1_Demo_Student_Import.xlsx`, review the validation preview, and confirm the import.
5. Open **Students & VIBANs**, select imported students, and provision their Virtual IBANs.
6. Use the search and status filters, then open a student's complete fee record.
7. Open **Fee invoices**, create a fee, and assign it to selected students.
8. Open an invoice group and filter students by Paid, Partially Paid, or Unpaid.
9. Open **Parent record search** and search for `12345678910`.
10. Return to the dashboard to review updated totals and collection activity.

## Demo behavior

- Existing active Virtual IBANs are reused, so repeat provisioning is safe.
- Confirmed transactions count toward collected values; pending transactions do not.
- Data is stored in memory and resets when the API server restarts.
- The provider status is explicitly labeled **Demo environment**.

## Production build

Run `npm run build`. The compiled frontend is written to `dist`.
