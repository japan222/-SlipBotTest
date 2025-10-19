// routes/line-webhook.js
import * as line from "@line/bot-sdk";
import * as crypto from "crypto";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";

import { handleEvent } from "../handlers/handleEvent.js";
import { loadShopData, shopData } from "../utils/loadShopData.js";

const envPath = path.join(process.cwd(), "info.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const PORT = process.env.PORT || 5000;
export const baseURL = process.env.URL || `http://localhost:${PORT}`;

function setCorrectSignature(channelSecret) {
    return (req, res, next) => {
      if (!Buffer.isBuffer(req.body)) {
        console.error("❌ req.body ไม่ใช่ Buffer");
        return res.status(400).send("Invalid request format");
      }
  
      const computedSignature = crypto
        .createHmac("sha256", channelSecret)
        .update(req.body)
        .digest("base64");
  
      req.headers["x-line-signature"] = computedSignature;
      next();
    };
  }

export const setupWebhooks = async (app) => {
    // ลบเฉพาะ route ที่ขึ้นต้นด้วย "/webhook"
    app._router.stack = app._router.stack.filter((layer) => {
      return !(
        layer.route &&
        layer.route.path &&
        layer.route.path.startsWith("/webhook")
      );
    });

    await loadShopData(); // ใช้ async version

    shopData.forEach((shop) => {
      shop.lines.forEach((lineAccount) => {
        const prefix = shop.prefix;
        const lineName = lineAccount.linename;
        const channelID = String(lineAccount.channel_id).slice(-4);
        const lineConfig = {
          channelAccessToken: String(lineAccount.access_token),
          channelSecret: String(lineAccount.secret_token),
        };
            const accessToken = lineConfig.channelAccessToken
            const client = new line.Client(lineConfig);
            const route = `/webhook/${shop.prefix}/${channelID}.bot`;

            // กำหนด Middleware ให้ใช้ `express.raw()` เฉพาะ Webhook เท่านั้น
            app.post(
              route, // ใช้ route จากข้างบนตรง ๆ เลย
              setCorrectSignature(lineConfig.channelSecret),
              line.middleware(lineConfig),
              async (req, res) => {
                const events = req.body.events || [];
                await Promise.all(
                  events.map(async (event) => await handleEvent(event, client, prefix, lineName, accessToken, baseURL))
                );
                res.status(200).send("OK");
              }
          );
      });
  });
};
