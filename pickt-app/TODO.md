# To do

Things deliberately left for later. Each says what exists today and what's missing.

## Placements

- **Real 30- and 90-day check-ins.** Today the progress line (Offer → Started → 30 days → 90 days)
  is worked out from the start date only. Nobody confirms the person is still there.
  Needed: a check-in record per hire (date, confirmed by, still employed yes/no), reminders to the
  hiring company at 30 and 90 days, and what happens to fees and commission if someone leaves early.
- **Fee invoicing and payment.** Placement fees show "Due" 30 days after the start date, and
  `hires.fee_paid_at` (migration 037) is never set yet. Needed: invoices, a way for Pickt admins to
  mark a fee paid, and agreed payment terms (the 30 days is a placeholder).
- **Confidential hires.** Referrers currently see the name of the company that hired their referral.
  Some employers may want to hide that. Needed: a per-hire "confidential" option and what referrers
  see instead.

## Manage access

- Per-person exceptions (today permissions are per role: Admin or Member).
- Emailing the Owner when someone asks for access to fees or commission.
