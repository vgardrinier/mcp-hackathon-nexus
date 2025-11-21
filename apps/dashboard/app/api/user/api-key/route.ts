import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const authToken = req.headers.get("authorization")?.replace("Bearer ", "");

    // Get user ID from auth token or session
    let userId: string | null = null;

    if (authToken) {
      // Verify token with Supabase
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser(authToken);

      if (!authError && user) {
        userId = user.id;
      }
    } else {
      // Try to get from session cookie
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const { createServerClient } = await import("@supabase/ssr");
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      });

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        userId = session.user.id;
      } else {
        const {
          data: { user },
          error: authError
        } = await supabase.auth.getUser();

        if (!authError && user) {
          userId = user.id;
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("api_key")
      .eq("id", userId)
      .maybeSingle<{ api_key: string }>();

    if (error || !data) {
      return NextResponse.json({ error: "Failed to fetch API key" }, { status: 500 });
    }

    return NextResponse.json({ apiKey: data.api_key }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/user/api-key:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

