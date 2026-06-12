import { createClient } from "@supabase/supabase-js";
import { demoClient, DEMO_FLAG } from "./demo";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Demo mode: full app on sample data in localStorage, no backend needed.
export const isDemo =
  typeof localStorage !== "undefined" && localStorage.getItem(DEMO_FLAG) === "1";

export const isConfigured =
  isDemo || Boolean(url && anonKey && !url.includes("YOUR-PROJECT"));

export const supabase: any = isDemo
  ? demoClient
  : createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder");

// Phone + PIN login without paid SMS: the phone number is mapped to a synthetic
// email under the hood, and the PIN is the password.
export const phoneToEmail = (phone: string) =>
  `p${phone.replace(/\D/g, "")}@tiffin-tracker.app`;
