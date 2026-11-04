#!/bin/bash -e
#
# Builds RR Calc for Android (android/build/rr-calc.apk) with the Android SDK's own tools, no
# Gradle: aapt2 for the manifest and resources, javac and d8 for MainActivity, then zipalign and
# apksigner. Needs ANDROID_HOME (or ANDROID_SDK_ROOT) with a platform and build-tools, and a JDK;
# GitHub's runners have both (.github/workflows/android.yml).
#
# VERSION_CODE / VERSION_NAME: the app's version (CI uses the run number).
# Signing: ANDROID_KEYSTORE (a .p12/.jks path), ANDROID_KEYSTORE_PASSWORD and ANDROID_KEY_ALIAS.
# Without them a throwaway key is made for this build. Android only installs a new APK over the
# old one (keeping the app's data) when both are signed with the same key, so keep one key in
# the repo's secrets (see the workflow); the key is never committed.

cd "$(dirname "$0")"
SDK=${ANDROID_HOME:-$ANDROID_SDK_ROOT}
[ -d "$SDK" ] || { echo "Set ANDROID_HOME to the Android SDK" >&2; exit 1; }
BT=$(ls -d "$SDK"/build-tools/*/ | sort -V | tail -1)
PLATFORM=$(ls -d "$SDK"/platforms/android-*/ | sort -V | tail -1)
ANDROID_JAR=$PLATFORM/android.jar
VERSION_CODE=${VERSION_CODE:-1}
VERSION_NAME=${VERSION_NAME:-1.0.$VERSION_CODE}
echo "build-tools: $BT"
echo "platform: $PLATFORM"
echo "version: $VERSION_NAME ($VERSION_CODE)"

rm -rf build && mkdir -p build/res build/classes build/dex

if [ -z "$ANDROID_KEYSTORE" ]; then
	echo "No ANDROID_KEYSTORE: signing with a throwaway key (this APK won't update one signed with another key)"
	ANDROID_KEYSTORE=build/throwaway.p12
	ANDROID_KEYSTORE_PASSWORD=throwaway
	ANDROID_KEY_ALIAS=throwaway
	keytool -genkeypair -keystore "$ANDROID_KEYSTORE" -storetype PKCS12 -alias "$ANDROID_KEY_ALIAS" \
		-keyalg RSA -keysize 2048 -validity 10000 -storepass "$ANDROID_KEYSTORE_PASSWORD" \
		-keypass "$ANDROID_KEYSTORE_PASSWORD" -dname "CN=RR Calc" > /dev/null
fi

"$BT/aapt2" compile --dir res -o build/res/res.zip
"$BT/aapt2" link -o build/base.apk -I "$ANDROID_JAR" --manifest AndroidManifest.xml \
	--version-code "$VERSION_CODE" --version-name "$VERSION_NAME" build/res/res.zip

javac -source 8 -target 8 -Xlint:-options -encoding UTF-8 -bootclasspath "$ANDROID_JAR" -d build/classes \
	$(find src -name '*.java')
"$BT/d8" --release --min-api 29 --lib "$ANDROID_JAR" --output build/dex $(find build/classes -name '*.class')

export ANDROID_KEYSTORE_PASSWORD
cp build/base.apk build/unsigned.apk
(cd build/dex && zip -q -j ../unsigned.apk classes.dex)
"$BT/zipalign" -p -f 4 build/unsigned.apk build/aligned.apk
"$BT/apksigner" sign --ks "$ANDROID_KEYSTORE" --ks-pass env:ANDROID_KEYSTORE_PASSWORD \
	${ANDROID_KEY_ALIAS:+--ks-key-alias "$ANDROID_KEY_ALIAS"} --out build/rr-calc.apk build/aligned.apk
"$BT/apksigner" verify --print-certs build/rr-calc.apk
ls -l build/rr-calc.apk
