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

## Dashboard

- **Roles are saved searches for now.** A company's "active roles" are its people's saved
  Marketplace searches. There's no "closed" state or company-owned role yet; a proper Roles
  feature (title, owner, open/closed, job description) would replace this.
- **Contact tracking is per company, not per person.** "Mark as contacted" / "Interviewing" are
  shared by everyone in the company. There's no history of who contacted whom, or notes.
- **Team activity for referrals** shows the company, not the person, because referrals don't
  record which user made them yet.
- **Matching runs on every Dashboard visit.** Fine at today's size; with many thousands of
  candidates, match counts should be worked out in the database or cached.
