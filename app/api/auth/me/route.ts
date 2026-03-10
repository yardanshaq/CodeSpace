import { NextResponse } from "next/server";
import { getSession, deleteSession, clearSessionCookie, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — cek session saat ini
// Jika session tidak valid / expired, otomatis clear cookie
// sehingga browser tidak perlu hapus manual (fix untuk iPhone)
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      // Session tidak ditemukan di DB (expired atau tidak valid)
      // Clear cookie di browser supaya tidak stuck redirect terus
      const response = NextResponse.json({ authenticated: false }, { status: 200 });
      clearSessionCookie(response);
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id:       session.id,
        username: session.username,
        email:    session.email,
        role:     session.role,
      },
    });
  } catch (error) {
    console.error(error);
    // Kalau error (misal DB down), clear cookie juga supaya tidak loop
    const response = NextResponse.json({ authenticated: false }, { status: 200 });
    clearSessionCookie(response);
    return response;
  }
}

// POST — logout
export async function POST() {
  try {
    await deleteSession();
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}