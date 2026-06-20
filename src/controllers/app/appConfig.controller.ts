import { Request, Response } from "express";
import prisma from "../../services/prisma";

// Fallback defaults if the config row is missing, so the app never crashes on
// a bad response (it just won't prompt to update).
const DEFAULTS = {
  ios: {
    minVersion: "1.0.0",
    latestVersion: "1.0.0",
    storeUrl: "https://apps.apple.com/app/id6759828278",
  },
  android: {
    minVersion: "1.0.0",
    latestVersion: "1.0.0",
    storeUrl: "https://play.google.com/store/apps/details?id=com.eotec.frame",
  },
};

/**
 * GET /public/version/app
 * Returns the mobile app version gate (min/latest version + store URL per
 * platform). The app uses it on launch to force-update or softly nudge.
 */
export async function getAppVersionConfig(_req: Request, res: Response) {
  try {
    const config = await prisma.app_config.findFirst({
      orderBy: { id: "asc" },
    });

    if (!config) {
      res.json(DEFAULTS);
      return;
    }

    res.json({
      ios: {
        minVersion: config.ios_min_version,
        latestVersion: config.ios_latest_version,
        storeUrl: config.ios_store_url,
      },
      android: {
        minVersion: config.android_min_version,
        latestVersion: config.android_latest_version,
        storeUrl: config.android_store_url,
      },
    });
  } catch (err) {
    console.error("/version/app error:", err);
    // Degrade gracefully: never block the app if the config can't be read.
    res.json(DEFAULTS);
  }
}
