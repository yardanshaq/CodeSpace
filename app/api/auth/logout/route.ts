import { NextResponse } from "next/server";
import { deleteSession, clearSessionCookie } from "@/lib/auth";

export async function POST() {
  try {
    await deleteSession();

    const isProduction = process.env.NODE_ENV === "production";
    const response = NextResponse.json({ success: true });

    // Hapus cookie session aktif
    clearSessionCookie(response);

    // Bersihkan cookie JWT lama kalau masih ada di browser pengguna
    response.cookies.set("auth_token", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}