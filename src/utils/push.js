import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const registerPushTokenFn = httpsCallable(functions, "registerPushToken");

async function ensurePushPermissions() {
  const status = await PushNotifications.checkPermissions();
  if (status.receive === "granted") return true;

  const req = await PushNotifications.requestPermissions();
  return req.receive === "granted";
}

async function waitForRegistrationToken() {
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

  const granted = await ensurePushPermissions();
  if (!granted) return { ok: false, reason: "permission-denied" };

  const token = await waitForRegistrationToken();
  if (!token) return { ok: false, reason: "no-token" };

  await registerPushTokenFn({
    token,
    platform: Capacitor.getPlatform(),
    deviceId: options.deviceId || null,
  });

  return { ok: true, token };
}
