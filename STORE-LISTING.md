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
Start and end your shift from the home screen. While a shift is running, your
location is shared with dispatch so the office can see where the fleet is. It
stops the moment you end the shift.

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

It starts when you press Start Shift and stops when you press End Shift. It is
not collected at any other time. If a shift is left running by mistake, sharing
stops automatically after 16 hours.

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

```
MiDrive DA is a workforce app for delivery drivers, provided by their employer.

Drivers press "Start Shift" at the beginning of their working day. While that
shift is running, the app shares the driver's location with their dispatch
team, so the office can see where vehicles are across the round, route work
sensibly, and respond if a driver has a problem on the road.

This has to work in the background because a driver is driving. The phone is in
a cradle or a pocket and the app is not on screen for most of the shift, but
dispatch still needs to know where the vehicle is.

Collection is strictly bounded:

- It begins only when the driver presses Start Shift.
- It ends the moment the driver presses End Shift.
- If a shift is left running by mistake, collection stops automatically after
  16 hours.
- A foreground service notification is visible for the entire time location is
  being shared, and the app's home screen shows what time sharing started.

No location is collected outside a shift. The feature cannot be enabled
remotely or by the employer; only the driver starts and stops it.

Location data is visible only to the driver's own employer. It is not sold, not
used for advertising, and not shared with other companies.
```

### Prominent disclosure shown in the app

Shown **before** the background permission prompt, on pressing Start Shift.
Source: `src/components/shift-toggle.tsx`.

```
Sharing your location on shift

MiDrive DA collects your location and shares it with your dispatch team so they
can see where the fleet is during the working day.

This continues in the background, even when the app is closed or not in use.

It starts when you press Start Shift and stops the moment you press End Shift.
It is not collected at any other time.

[Not now]  [Continue]
```

### The video Play will ask for

Record on a real device, roughly 30 seconds, no narration needed:

1. Open the app, signed in, on the home screen
2. Press **Start Shift**
3. Show the disclosure dialog above, unhurried enough to read
4. Press **Continue**, then **Allow all the time** on the Android prompt
5. Show the ongoing notification in the shade
6. Return to the app and press **End Shift**, confirm, and show the
   notification gone

That sequence is the whole argument: bounded, disclosed, visible, reversible.

---

## Screenshots

At least two phone screenshots, 16:9 or 9:16, minimum 320px on the short edge.
Worth capturing:

1. Home — the shift toggle and the day's route
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
