# Klickit Virtual IBAN — Sprint 1 and Sprint 2 Prototypes

This application contains two deliberately separate prototypes:

- **Sprint 1:** the school finance interface, backed by an Express API with in-memory demo data.
- **Sprint 2:** the complete parent interface and Klickit Checkout journey.
- **Sprint 3 integration prototype:** shared backend records, timed provider confirmation, automatic reconciliation, and synchronized parent and school balances.

The bank remains a sandbox simulation because production provider credentials are unavailable. The application does not expose a simulation button: after a parent enters an intended amount, the backend receives a provider-style credit about five seconds later, verifies it, reconciles the actual received amount, and updates both interfaces.

All records are intentionally stored in memory. Stopping the hosting process discards every test
change, Checkout session, and generated payment. Starting the app again restores the complete seeded
demo data automatically, so no test data needs to be entered again.

## Run the demo

1. Double-click `run_app.py`, or run `python run_app.py` from PowerShell.
2. Wait for the browser to open automatically.

The launcher installs dependencies automatically if they are missing. You can also start the application manually with `npm run dev`.

The frontend runs on port 5173 and the local API runs on port 3001.

## Sign in

### Sprint 1 school interface

- Username: `finance`
- Password: `finance`

Open `http://localhost:5173/login`.

### Sprint 2 parent interface

- Username: `parent`
- Password: `parent`

Open `http://localhost:5173/parent/login`.

## Recommended Sprint 1 demonstration sequence

1. Sign in and review the collection dashboard.
2. Open **Import students** and download the Excel template.
3. Upload `Sprint1_Demo_Student_Import.xlsx`, review the validation preview, and confirm the import.
5. Open **Students & VIBANs**, select imported students, and provision their Virtual IBANs.
6. Use the search and status filters, then open a student's complete fee record.
7. Open **Fee invoices**, create a fee, and assign it to selected students.
8. Open an invoice group and filter students by Paid, Partially Paid, or Unpaid.
9. Open **Parent record search** and search for `12345678910`.
10. Return to the dashboard to review updated totals and collection activity.

## Recommended Sprint 2 demonstration sequence

1. Sign in through `/parent/login`.
2. Review the combined family outstanding balance and the separate balance for each linked student.
3. Open one student to review assigned Paid, Partially Paid, and Unpaid invoices.
4. Open **School fees** to filter all family invoices by student and status.
5. Select an Unpaid or Partially Paid invoice and create a Checkout session.
6. Choose bank transfer and enter the complete remaining amount. Card instead charges the complete remaining balance automatically and shows no amount field.
7. Continue the transfer and observe **Awaiting Bank Confirmation** for about five seconds.
8. Try to pay another invoice and observe that the active session prevents parallel payments.
9. The first substantial bank transfer arrives 1,000 SAR short in the sandbox. Review the confirmed partial amount and enter the remaining amount.
10. Complete the second transfer, then review the Paid and Reconciled result in both parent and school interfaces.
11. Open **Payment history** to review transaction and reconciliation details.

## Demo behavior

- Existing active Virtual IBANs are reused, so repeat provisioning is safe.
- Confirmed transactions count toward collected values; pending transactions do not.
- Data is stored in memory and resets when the API server restarts.
- The provider status is explicitly labeled **Demo environment**.
- Parent authentication and Checkout sessions are stored by the backend.
- Checkout never displays success before the backend receives and verifies the provider credit.
- The first substantial bank-transfer confirmation is intentionally 1,000 SAR below the entered amount so the partial-payment and second-transfer flow can be demonstrated.

## Production build

Run `npm run build`. The compiled frontend is written to `dist`.
