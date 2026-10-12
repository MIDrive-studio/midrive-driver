# App Store listing — MiDrive DA

Apple's side of `STORE-LISTING.md`. Same facts, different form shape — Apple's
fields and limits aren't Google's, and the App Privacy "nutrition label" sorts
data into Apple's own fixed categories, not Android's per-field list. Keep
both files in step if the app changes; if a change to one invalidates the
other, say so in the same commit.

**Privacy policy URL:** `https://midrive-v2.vercel.app/privacy` (same page
Android uses — Apple accepts one privacy policy URL, same as Google).

---

## App Information

**Name:** `MiDrive DA`

**Subtitle** (30 characters max, shown under the name in search):

```
Van checks, shifts & pay
```

*24 characters.*

**Category:** Business (primary). No secondary category needed.

**Support URL:** `https://midrive-v2.vercel.app`
**Marketing URL:** leave blank — not required, and there's no separate
marketing site to point at.

---

## Version 1.0 — Product Page

**Promotional Text** (170 characters, the one field editable without a new
review — safe to reuse as-is after launch):

```
Your daily van check, automatic shift tracking, routes and pay — the MiDrive
DA app for delivery drivers, provided by your employer.
```

*134 characters.*

**Description** (4000 characters max) — identical to Android's, since it was
already written platform-neutral:

```
MiDrive DA is the driver app for MiDrive, the fleet system your depot runs on.
It is provided by your employer — you will need an account from them to sign in.

WHAT YOU CAN DO

Daily vehicle check
Photograph the van before you set off, guided one angle at a time with an
outline to line up against. The check records the van's condition on the day
you drove it, so marks that were already there do not become your problem
later.

Your shift
Your shift begins once you submit your daily vehicle check — nothing extra to
press. While it's running, your location is shared with dispatch so the office
can see where the fleet is. It stops the moment you end the shift from the
home screen.

Your day
See the route and van you are rostered to, and tell the office which days you
are available to work.

Pay
Check the routes you have been paid for, week by week, and see your payslips.

Fuel
Record a fuel purchase against the card and van you are using.

Accidents
Report an incident from the roadside, with photographs and location, so the
office has it immediately rather than at the end of the day.

LOCATION

This app collects location data to share your position with your dispatch team
while you are on shift. This continues in the background, even when the app is
closed or not in use.

It starts once your daily vehicle check is submitted — the first time, you're
shown an in-app explanation and asked to agree before it begins — and stops
when you press End Shift. It is not collected at any other time. If a shift is
left running by mistake, sharing stops automatically after 12 hours.

You need an account from your employer to use this app.
```

**Keywords** (100 characters, comma-separated, no spaces after commas to save
room — Apple strips plurals/case automatically, so no need to list variants):

```
delivery,driver,van check,fleet,logistics,shift,dispatch,route,payslip,vehicle inspection
```

*89 characters.*

---

## App Privacy ("Nutrition Label")

Apple sorts into its own fixed categories, not Android's per-field list — this
is the mapping from the Data safety table in `STORE-LISTING.md`. For every row
below: **Linked to the user** = Yes, **Used to track you** = No (nothing here
is used for cross-app/cross-site tracking or ad targeting — see the Data
safety form's own "Shared: No" note, same reasoning applies).

| Apple category | What it covers here | Collected | Purpose |
|---|---|---|---|
| Location → Precise Location | Live position while on shift | Yes | App Functionality |
| Contact Info → Name | Driver's name | Yes | App Functionality |
| Contact Info → Email Address | Sign-in | Yes | App Functionality |
| Contact Info → Phone Number | Optional contact field | Optional | App Functionality |
| Contact Info → Physical Address | Optional address field | Optional | App Functionality |
| Financial Info → Other Financial Info | Payroll/bank details | Optional | App Functionality |
| User Content → Photos or Videos | Vehicle check / accident photos | Yes | App Functionality |
| Other Data | Employment info (role, site, rota) | Yes | App Functionality |

Answer the two standing questions the same way as Android's form:

- **Data used to track you?** No.
- **Data linked to your identity?** Yes, all rows above — it's tied to the
  driver's account, same as the Android Data Safety answers.

---

## App Review Information — Notes field

Apple's reviewer reads this before testing the background-location permission,
same purpose as Google's written declaration. Reuses the same explanation,
Apple's phrasing:

```
MiDrive DA shares a driver's location with their dispatch office only while
they are on an active shift, so the office can locate them for a breakdown,
send help, reroute a nearby driver to cover a stop, or guide them to a
hard-to-find address.

A shift begins automatically the moment the driver submits their daily
vehicle-check photographs — there is no button for it. The first time this
would happen on a device, the app shows an in-app explanation and only
requests "Always" location access if the driver agrees; after that it does
not ask again. A shift always ends, and location sharing stops, the moment the
driver presses End Shift — and automatically after 12 hours if one is ever
left running by mistake.

This is the app's only use of background location. A demo account is
available on request if useful for review.
```

Reviewer test account: offer one if Apple's reviewer asks — same test driver
used for the Play Store submission works here too (no separate iOS-only
account needed, same Supabase backend).

---

## Screenshots

Apple requires specific device sizes — the Android screenshots **do not
satisfy these** and need retaking on an iOS device or Simulator:

- **6.9" display** (iPhone 16 Pro Max class) — required
- **6.5" display** (iPhone 11 Pro Max / XS Max class) — required if no 6.9"
  alternative is accepted for older devices still on sale; safest to provide
  both
- iPad: not needed — `supportsTablet` is `false` in `app.json`, so there is no
  iPad build to screenshot

Same four shots as Android, same reasoning (realistic but not identifying
test data):

1. Home — the shift card and the day's route
2. Vehicle check — the camera with the van outline overlay
3. Availability
4. Pay

---

## Age Rating

Apple's questionnaire (replaces Play's content rating): no user-generated
content shared publicly, no ads, no gambling, no mature content. Should come
out at **4+**, same reasoning as Android's PEGI 3 — business tool, not a
general-audience app, but nothing in it warrants restriction either. Account
creation is employer-provisioned only, same as Android.

## Export Compliance

`ITSAppUsesNonExemptEncryption: false` is already set in `app.json` — the app
only uses standard HTTPS/TLS via Supabase, no proprietary encryption, so this
answers Apple's export-compliance question automatically on every build
rather than asking at each submission.
