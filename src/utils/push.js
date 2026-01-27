import { httpsCallable } from "firebase/functions";
import { Capacitor } from "@capacitor/core";
import { functions } from "./firebase";

const registerPushTokenFn = httpsCallable(functions, "registerPushToken");

let pushNotificationsPromise = null;

// Only attempt to load on native platforms (iOS/Android)
export async function getPushNotifications() {
  if (!Capacitor.isNativePlatform()) return null;
  if (!pushNotificationsPromise) {
    pushNotificationsPromise = import("@capacitor/push-notifications")
      .then((mod) => mod.PushNotifications)
      .catch(() => null);
  }
  return pushNotificationsPromise;
}

async function ensurePushPermissions(PushNotifications) {
  const status = await PushNotifications.checkPermissions();
  if (status.receive === "granted") return true;

  const req = await PushNotifications.requestPermissions();
  return req.receive === "granted";
}

async function waitForRegistrationToken(PushNotifications) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let regSub;
    let errSub;

    const cleanup = async () => {
      if (regSub) await regSub.remove();
      if (errSub) await errSub.remove();
    };

    PushNotifications.addListener("registration", async (token) => {
      if (resolved) return;
      resolved = true;
      await cleanup();
      resolve(token?.value);
    }).then((sub) => {
      regSub = sub;
    });

    PushNotifications.addListener("registrationError", async (error) => {
      if (resolved) return;
      resolved = true;
      await cleanup();
      reject(error);
    }).then((sub) => {
      errSub = sub;
    });

    PushNotifications.register().catch(async (err) => {
      await cleanup();
      reject(err);
    });
  });
}

export async function registerDevicePushToken(user, options = {}) {
  if (!user?.uid) return { ok: false, reason: "no-user" };
  if (user.notifications && user.notifications.push === false) {
    return { ok: false, reason: "push-disabled" };
  }
  if (!Capacitor.isNativePlatform()) return { ok: false, reason: "not-native" };

  const PushNotifications = await getPushNotifications();
  if (!PushNotifications) return { ok: false, reason: "not-available" };

  const granted = await ensurePushPermissions(PushNotifications);
  if (!granted) return { ok: false, reason: "permission-denied" };

  const token = await waitForRegistrationToken(PushNotifications);
  if (!token) return { ok: false, reason: "no-token" };

  await registerPushTokenFn({
    token,
    platform: Capacitor.getPlatform(),
    deviceId: options.deviceId || null,
  });

  return { ok: true, token };
}
