# Getting the driver app onto phones

Two stages. This document covers the first and sets up for the second, so
nothing here is repeated later.

1. **Internal distribution** — a build your own drivers install directly. No
   store, no review, no fees.
2. **The stores** — App Store and Play Store. Needs paid developer accounts and
   review time. Everything configured below carries straight over.

## What is already done

| | |
|---|---|
| App name | `MiDrive Driver` — what appears under the icon |
| iOS bundle id | `uk.co.unitedeliveries.midrivedriver` |
| Android package | `uk.co.unitedeliveries.midrivedriver` |
| Icons | Generated from the portal's brand mark |
| `eas.json` | `development`, `preview` and `production` profiles |
| Permissions | Location (incl. background) and camera, declared with reasons |

**The bundle id and package are effectively permanent.** They can be changed
freely today; after a store release, changing one means a new listing with no
carry-over of installs or reviews. Say now if `uk.co.unitedeliveries…` is wrong —
for example if MiDrive should be branded separately from United Deliveries.

## Stage 1 — onto real phones

### One-off setup

```bash
npm install -g eas-cli
eas login                 # a free Expo account; create one if you have none
```

Then, from this directory:

```bash
eas init                  # links this repo to an Expo project, writes the id
```

### Configuration the build needs

The app reads Supabase from `EXPO_PUBLIC_*` variables. `.env` is gitignored and
EAS builds from git, so the build will not see it — the values go to EAS instead:

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://…supabase.co" --environment production --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ…" --environment production --environment preview --visibility plaintext
```

`plaintext` is correct here and not an oversight. Anything prefixed
`EXPO_PUBLIC_` is compiled into the app bundle and can be read out of it by
anyone who installs it, so treating these as secret would be theatre. They are
safe to expose for the same reason the portal's anon key is: Row Level Security
is what actually protects the data. **Never** put the service-role key here.

`EXPO_PUBLIC_PORTAL_URL` is already set in `eas.json` — it is only a URL.

### Build it

**Android** — the easy one. Produces an APK anyone can install:

```bash
eas build --platform android --profile preview
```

Roughly 10–20 minutes on the free tier. You get a link. Send it to a driver;
they open it on the phone and install. Android asks them to allow installing
from an unknown source — expected, and the only friction in the whole path.

**iOS** — needs an Apple Developer account (£79/yr) even for internal testing.
Apple has no equivalent of sideloading. If you have one:

```bash
eas build --platform ios --profile preview
```

Every test device's UDID must be registered first (`eas device:create`). If you
do not have an account yet, test on Android and come back to iOS at stage 2 —
the code is identical.

## Stage 2 — the stores

Not yet done, and needing accounts rather than code:

- **Apple Developer** — £79/yr, review typically 1–3 days
- **Google Play** — £20 one-off, review 1–7 days for a first submission
- Store listing: description, screenshots at several sizes, support URL
- Privacy declarations for location and camera

One thing to plan for: **background location gets extra Google scrutiny**. The
app declares `ACCESS_BACKGROUND_LOCATION` for shift tracking, and Play requires
a written justification plus, usually, a short video showing the in-app
disclosure and what the feature does. It is approvable — this is a legitimate
fleet use — but it is the single most likely cause of a rejected first
submission, so budget for one round trip.

Build for the stores with:

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

## Updating drivers afterwards

Most changes need no new build at all. JavaScript-only changes ship over the air:

```bash
eas update --branch preview --message "what changed"
```

Drivers get it on next launch. A new build is only required when native
configuration changes — a new permission, a new native module, an icon, or
anything in `app.json`.
