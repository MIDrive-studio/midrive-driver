# Getting the driver app onto phones

Two ways in, and they are not alternatives — the first is how you test, the
second is how you distribute.

1. **Internal distribution** — an APK you send to a driver directly. No store,
   no review, no fees. Already working.
2. **Google Play** — the real launch. Needs the Play Console (set up), a store
   listing, and review.

## What is already done

| | |
|---|---|
| App name | `MiDrive Driver` |
| Package | `uk.co.unitedeliveries.midrivedriver` |
| Icons | Generated from the portal's brand mark |
| EAS project | `@arahman786/midrive-driver` |
| Signing | Keystore generated and held by Expo |
| Config | Supabase and portal URL set for all three environments |
| Updates | `expo-updates` installed — JavaScript changes ship without a build |
| Profiles | `preview` builds an APK, `production` builds an AAB (what Play requires) |

**The package name is permanent from the first Play upload.** Changing it later
means a new listing with no carry-over of installs or reviews. Say now if
`uk.co.unitedeliveries.midrivedriver` is wrong.

## Before submitting anything

**Install the current preview APK and confirm the app opens.** The first build
crashed on launch — `expo-font` and `expo-linking` were missing, which Expo Go
provides but a standalone build does not. That is fixed, but fixed-in-theory is
not the same as opened-on-a-phone, and an app that crashes on launch fails Play
review outright.

Run `npx expo-doctor` before any build. It catches exactly that class of
problem, and would have caught this one.

## Google Play, step by step

### 1. Create the app in Play Console

**All apps → Create app.** Name `MiDrive Driver`, language, **App** (not game),
**Free**. The package name is set by the upload, not typed here.

### 2. The service account, so releases can be pushed from here

Play Console → **Setup → API access** → create or link a Google Cloud project →
**Create service account**. In Google Cloud, give it a key (JSON) and download
it. Back in Play Console, grant that account **Release manager** on this app.

Save the JSON as `play-service-account.json` in this folder. It is gitignored —
it can publish releases, so treat it like a password.

### 3. The listing

Play will not let you release without:

- Short description (80 chars) and full description
- **Feature graphic** 1024×500
- **At least 2 phone screenshots** — take them from a real device
- App icon 512×512
- **A privacy policy at a public URL.** Not optional, and see below.
- Content rating questionnaire
- Data safety form — declare location, camera, and the personal data collected

### 4. The part most likely to cost you a rejection

This app declares `ACCESS_BACKGROUND_LOCATION`, for shift tracking. Google
reviews that far more heavily than anything else here and will ask for:

- A written justification of why the feature needs background location
- Usually **a short video** showing the in-app disclosure and the feature working
- A privacy policy that names background location explicitly

It is a legitimate fleet use and it does get approved, but budget for one round
trip rather than being surprised by it. If you want to launch sooner, the
alternative is shipping without background location and adding it in a later
release, once the app is already live.

### 5. Build and submit

```bash
eas build --platform android --profile production
eas submit --platform android --latest
```

`eas.json` submits to the **internal testing** track as a **draft**. That is
deliberate: internal testing has no review wait, so you can install from Play
and check the whole thing works before anything is public. Promote to production
in the console when you are happy.

## Updating afterwards

Two different mechanisms, and the difference matters:

| Change | How |
|---|---|
| JavaScript, styling, copy, most fixes | `eas update --branch production` — reaches phones on next launch, no review |
| Native config, permissions, icon, new native module | New build, new Play release, review again |

So most updates do not go through Google at all. Store distribution and
over-the-air updates are separate things, and you get both.

## iOS

Not started. Needs an Apple Developer account (£79/yr) before it will build at
all, even for internal testing. Everything configured here carries over — the
identifiers, the icons, the environment variables and the update channel.
