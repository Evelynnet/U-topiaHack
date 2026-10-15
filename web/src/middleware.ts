import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, defaultLocale, isLocale, type Locale } from "./i18n/config";
import { SESSION_COOKIE, readSessionToken } from "./lib/token";

// Pages that need a signed-in user. The home page (the map) is public.
const PROTECTED = ["owner", "bookings", "admin"];

function pickLocale(req: NextRequest): Locale {
  const saved = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  const accept = req.headers.get("accept-language")?.toLowerCase() ?? "";
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2);
    if (isLocale(code)) return code;
  }
  return defaultLocale;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const [, first, second] = pathname.split("/");

  // 1) Make sure every page URL starts with a locale.
  if (!isLocale(first)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${pickLocale(req)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // 2) Old URLs: the map is the home page and login/sign-up are a pop-up on it.
  if (second === "map" || second === "login" || second === "register") {
    const url = req.nextUrl.clone();
    url.pathname = `/${first}`;
    url.search = second === "login" ? "?login=1" : second === "register" ? "?signup=1" : "";
    return NextResponse.redirect(url);
  }

  // 3) Private pages: send guests to the home page with the login pop-up open,
  //    and bring them back to where they were headed after they sign in.
  const session = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (PROTECTED.includes(second) && !session) {
    const url = req.nextUrl.clone();
    url.pathname = `/${first}`;
    url.search = `?login=1&next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  if (second === "admin" && session && session.role !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = `/${first}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  res.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}

export const config = {
  // Skip API routes, Next internals and any file with an extension.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
