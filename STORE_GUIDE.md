# Publishing List to Google Play and the App Store

This repo is already set up as an iOS and Android app using [Capacitor](https://capacitorjs.com). The app itself is the web app in `www/`; `android/` and `ios/` are the native shells around it.

**App ID:** `io.github.lanesisson22lang.list`. It's set in `capacitor.config.json`, `android/app/build.gradle` and the Xcode project. **You can't change it after your first store upload**, so if you want a different one (for example `com.yourname.list`), ask Claude to change it before then.

---

## 0. Try it on your Android phone (free, no accounts)

1. Push to GitHub. The **Android build** workflow runs automatically (repo → **Actions** tab).
2. Open the latest run and download **list-debug-apk** under *Artifacts*, then unzip it.
3. Send the `.apk` to your phone, open it and allow "install unknown apps" when asked.

## 1. Host the web version and privacy policy (free)

Both stores require a privacy policy URL. One is included at `www/privacy.html`.

1. Merge this branch into `main`.
2. In the repo, go to **Settings → Pages → Source** and choose **GitHub Actions**.
3. The **Deploy web app to GitHub Pages** workflow publishes the site. Your privacy policy URL is `https://<your-username>.github.io/<repo>/privacy.html`.

> GitHub Pages on a free account requires the repo to be **public**.

---

## 2. Google Play

### One-time setup
1. **Create a developer account** at <https://play.google.com/console/signup> ($25, one-time, plus ID verification).
2. **Create an upload key.** On any computer with Java installed:
   ```sh
   keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 upload.jks > upload.jks.b64      # macOS: base64 -i upload.jks -o upload.jks.b64
   ```
   **Back up `upload.jks` and its passwords somewhere safe. Never commit them.**
3. **Add four repository secrets** under **Settings → Secrets and variables → Actions**:

   | Secret | Value |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | contents of `upload.jks.b64` |
   | `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
   | `ANDROID_KEY_ALIAS` | `upload` |
   | `ANDROID_KEY_PASSWORD` | the key password (often the same) |

   From now on every build also produces **list-release-aab**, a signed bundle ready for Play. The version code goes up automatically with each build.

### Each release
1. In Play Console, choose **Create app**, then fill in the name, language, "App" and "Free".
2. Complete **App content**: privacy policy URL, ads (*No*), data safety (*No data collected or shared*), content rating questionnaire, target audience.
3. Complete the **Store listing**: short and full description, 512×512 icon (`www/icons/icon-512.png`), a 1024×500 feature graphic, and at least 2 phone screenshots.
4. **Testing → Closed testing:** create a track, upload the `.aab` and add testers by email. New personal accounts must run a closed test with a minimum number of testers (currently 12) for 14 days before they can apply for production. Check the Play Console for the current rule.
5. Then **Production → Create release**, upload the `.aab` and submit for review.

---

## 3. Apple App Store

iOS apps can only be built on a Mac with **Xcode**. If you don't have a Mac, a cloud build service such as Codemagic or Ionic Appflow can build and upload it for you.

### One-time setup
1. **Join the Apple Developer Program** at <https://developer.apple.com/programs/> ($99/year).
2. On the Mac:
   ```sh
   git clone <this repo> && cd List
   npm ci
   npx cap sync ios
   npx cap open ios         # opens ios/App/App.xcodeproj in Xcode
   ```
3. In Xcode, select the **App** target → **Signing & Capabilities**, tick *Automatically manage signing* and choose your Team.
4. Try it: plug in your iPhone (or pick a simulator) and press ▶.

### Each release
1. In <https://appstoreconnect.apple.com>, go to **Apps → + → New App** and use bundle ID `io.github.lanesisson22lang.list`.
2. In Xcode, raise **Version**/**Build** under *General*, set the device to *Any iOS Device*, then **Product → Archive → Distribute App → App Store Connect**.
3. In App Store Connect, fill in the description, keywords, support URL, privacy policy URL and screenshots (6.9" iPhone required; add iPad screenshots if you keep iPad support). Under **App Privacy**, choose *Data Not Collected*.
4. Optionally test with **TestFlight** first, then **Submit for Review**.

**About guideline 4.2 (minimum functionality):** Apple sometimes rejects simple apps that feel like a website in a wrapper. List uses native storage, haptics, the native share sheet, a native splash screen and safe-area layout, which helps. If it's rejected anyway, the usual fix is adding a clearly native feature, such as reminder notifications or a home-screen widget, and resubmitting.

---

## Updating the app later

1. Edit files in `www/`.
2. Run `npx cap sync` (CI does this for Android automatically).
3. Raise the version (Android: automatic in CI; iOS: in Xcode), build, and upload as above.

To regenerate icons and splash screens after changing the images in `assets/`, run `npm run assets`.
