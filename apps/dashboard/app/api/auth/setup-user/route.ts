import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const { userId, email } = await req.json();

    if (!userId || !email) {
      return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
    }

    // First, verify the user exists in auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (authError || !authUser) {
      // User doesn't exist in auth.users yet (might need email confirmation)
      // This is OK - the trigger will handle it when they confirm
      return NextResponse.json({ 
        error: "User not found in auth.users",
        message: "User may need to confirm email first. Trigger will handle setup automatically."
      }, { status: 404 });
    }

    // Call the setup_new_user function
    const { data, error } = await supabaseAdmin.rpc("setup_new_user", {
      user_id: userId,
      user_email: email
    });

    if (error) {
      // If it's a foreign key error, user might have been created by trigger already
      if (error.code === "23503") {
        // Check if user already exists
        const { data: existingUser } = await supabaseAdmin
          .from("users")
          .select("api_key")
          .eq("id", userId)
          .single();
        
        if (existingUser) {
          return NextResponse.json({ apiKey: existingUser.api_key }, { status: 200 });
        }
      }
      
      console.error("Error setting up user:", error);
      console.error("Full error details:", JSON.stringify(error, null, 2));
      return NextResponse.json({ 
        error: "Failed to set up user", 
        details: error.message,
        code: error.code,
        hint: error.hint
      }, { status: 500 });
    }

    return NextResponse.json({ apiKey: data }, { status: 200 });
  } catch (error: any) {
    console.error("Error in /api/auth/setup-user:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error?.message || String(error)
    }, { status: 500 });
  }
}

