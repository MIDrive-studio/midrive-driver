# Google Play listing — MiDrive DA

Everything Play asks for, written from what the app actually does. Copy these
into the console; keep this file in step if the app changes.

**Privacy policy URL:** `https://midrive-v2.vercel.app/privacy`
(a page in the admin portal, deliberately public — see `app/privacy/page.tsx`)

---

## App name

```
MiDrive DA
```

## Short description (80 characters max)

```
Daily van checks, shifts and pay for delivery drivers.
```

*53 characters.*

## Full description

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

## Category

`Business`

## Tags

`Fleet management`, `Logistics`

## Contact details

- **Email:** `arahman@unitedeliveries.co.uk`
- **Website:** `https://midrive-v2.vercel.app`

---

## Data safety form

Play asks per data type. All answers below are true of the current build.

| Data type | Collected | Shared | Required | Purpose |
|---|---|---|---|---|
| Approximate location | Yes | No | Yes | App functionality |
| Precise location | Yes | No | Yes | App functionality |
| Name | Yes | No | Yes | App functionality, Account management |
| Email address | Yes | No | Yes | App functionality, Account management |
| Phone number | Yes | No | Optional | App functionality |
| Address | Yes | No | Optional | App functionality |
| Photos | Yes | No | Yes | App functionality |
| Employment info | Yes | No | Yes | App functionality |
| Financial info (payroll, bank) | Yes | No | Optional | App functionality |

**Shared** is "No" throughout: data goes to the driver's own employer, who is
the controller, and to processors acting on their instructions. Play counts
transfer to a processor as processing, not sharing.

Also answer:

- **Is all data encrypted in transit?** Yes
- **Can users request data deletion?** Yes — through their employer, and via the
  contact address in the privacy policy
- **Committed to Play Families policy?** Not applicable (18+ workforce app)

---

## Background location declaration

Play requires this in writing, and usually a short video. Both must match the
in-app disclosure word for word in substance.

### Why the app needs background location

Rejected once already for "unclear feature description" — the first attempt
named three operational benefits (breakdowns, rerouting, address help) without
stating they're one feature, which reads as three features competing for one
declaration, and Google only allows one. The Play Console form itself is three
separate fields, not one block of text — filled in below, each within that
field's own limit.

**The trigger changed since the first submission.** The green "Start Shift"
button on the home screen is gone — a shift now begins automatically the
moment the driver submits their daily vehicle check (`src/components/shift-card.tsx`).
Background location still never starts without the driver's agreement: the
first time it would start, the app shows the in-app disclosure and only
proceeds if the driver accepts; once agreed, it doesn't ask again each
morning. Every mention of "Start Shift" below is rewritten to match — if you
already recorded a video showing the old button, **re-record it**, since a
video that doesn't match the live app is its own ground for rejection.

**App purpose** (free text, no strict limit seen so far — current text is fine,
unchanged):

```
MiDrive is a driver management app used by delivery drivers to complete
vehicle inspections, view work assignments, manage onboarding documents and
report incidents. Location is used to support location-based operational
features.
```

**Location access** — "Describe one location-based feature in your app that
needs access to location in the background." **500 characters max.** This is
the field that was rejected; leads with the one feature, folds the three
scenarios into one clause each, states the bounds:

```
Live shift tracking: a driver's shift begins when they submit their daily
vehicle check, and the app then shares location with dispatch in the
background so the office can find them after a breakdown, send help, reroute
a nearby driver to cover stops, or guide them to a hard-to-find address.
First time, the driver sees an in-app explanation and must agree before
sharing starts. Ends on End shift, or automatically after 12 hours if left
running. The app's only background-location feature.
```

(492 characters.)

**Video instructions** — a YouTube link showing the in-app disclosure plus the
feature. The link on file, `https://youtube.com/shorts/ZjEZeWaitFw`, was almost
certainly recorded against the old "press Start Shift" flow and needs
re-recording against the current one — see the updated steps below — before
resubmitting.

### Prominent disclosure shown in the app

Shown **before** the background permission prompt — the first time a shift
would start, whichever of the two paths below gets it there. Source:
`src/components/shift-card.tsx` (`askForDisclosure`).

```
Sharing your location on shift

MiDrive DA collects your location and shares it with your dispatch team so they
can see where the fleet is during the working day.

This continues in the background, even when the app is closed or not in use.

It starts when your shift starts and stops the moment you end it. It is not
collected at any other time.

[Not now]  [Continue]
```

### The video Play will ask for

Record on a real device, roughly 30 seconds, no narration needed. The exact
steps depend on whether location has ever been agreed to on that device —
**use a clean install or a driver who has never agreed**, so the disclosure
actually appears on camera:

1. Open the app, signed in, on the home screen.
2. Complete today's vehicle check and submit it.
3. Back on the home screen, the shift card now shows **Start your shift** —
   press it. (Only appears because this device has never agreed before; once
   agreed, this step and the disclosure don't happen again on later days —
   the shift starts the moment the check is submitted.)
4. Show the disclosure dialog above, unhurried enough to read.
5. Press **Continue**, then **Allow all the time** on the Android prompt.
6. Show the ongoing notification in the shade, and the card now reading "On
   shift".
7. Return to the app and press **End shift**. You'll be asked whether there's
   new damage on the van — tap **No, end my shift** — then show the
   notification gone.

That sequence is the whole argument: bounded, disclosed, visible, reversible —
and it still matches the app exactly now that the button is gone from the
day-to-day path.

---

## Screenshots

At least two phone screenshots, 16:9 or 9:16, minimum 320px on the short edge.
Worth capturing:

1. Home — the shift card and the day's route
2. Vehicle check — the camera with the van outline overlay
3. Availability
4. Pay

Take them on a real device with realistic but not identifying data. A test
driver's record is fine; a real driver's address is not.

---

## Content rating

Business tool, no user-generated content shared publicly, no ads, no purchases.
The questionnaire should come out at **PEGI 3 / Everyone**.

## Target audience

**18 and over.** It is a workplace app and should not be listed as suitable for
children.
