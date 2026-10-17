import { api } from "../../../src/server/http";
import { appEnv } from "../../../src/server/appenv";

export const GET = api(() => ({ publicKey: appEnv().VAPID_PUBLIC_KEY ?? null }));
