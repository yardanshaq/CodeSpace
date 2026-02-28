import { NextResponse } from "next/server";
import { getSession, deleteSession, clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — cek session saat ini
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.id,
        username: session.username,
        role: session.role,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ authenticated: false }, { status: 200 });
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