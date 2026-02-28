/**
 * authCache — cache data user di localStorage agar navbar dan halaman lain
 * bisa langsung render tanpa menunggu fetch /api/auth/me selesai.
 *
 * Fetch ke /api/auth/me tetap berjalan di background untuk verifikasi.
 * Kalau session ternyata sudah tidak valid, cache dibersihkan dan
 * user akan di-redirect oleh masing-masing halaman.
 */

const STORAGE_KEY = "cs_user";

export interface CachedUser {
  username: string;
  role: "SUPERADMIN" | "ADMIN" | "MEMBER";
  id?: string;
}

/** Ambil data user dari cache localStorage. Mengembalikan null di server-side. */
export function getCachedUser(): CachedUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CachedUser) : null;
  } catch {
    return null;
  }
}

/**
 * Simpan atau hapus data user dari cache localStorage.
 * Kirim null untuk membersihkan cache (misalnya saat logout).
 */
export function setCachedUser(user: CachedUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Bisa terjadi jika storage penuh atau mode private — tidak fatal
  }
}
