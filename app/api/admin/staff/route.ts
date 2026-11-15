import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type UserRoleRecord = {
  role_id: number | null;
  user_roles: unknown;
};

function hasRoleName(relation: unknown, name: string) {
  const entries = Array.isArray(relation) ? relation : [relation];
  return entries.some(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      "role_name" in entry &&
      entry.role_name === name
  );
}

function hasAdminRole(record: UserRoleRecord) {
  return record.role_id === 2 || hasRoleName(record.user_roles, "admin");
}

export async function POST(request: NextRequest) {
  const accessToken = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return NextResponse.json({ error: "Sign in as an admin to continue." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email =
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
  const action =
    typeof body === "object" &&
    body !== null &&
    "action" in body &&
    typeof body.action === "string"
      ? body.action
      : "grant";
  if (action !== "grant" && action !== "revoke") {
    return NextResponse.json({ error: "Choose grant or revoke access." }, { status: 400 });
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!process.env.SUPABASE_SECRET_KEY) {
    console.error("Staff role assignment requires SUPABASE_SECRET_KEY.");
    return NextResponse.json(
      { error: "Staff role management is not configured on the server." },
      { status: 503 }
    );
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const {
      data: { user: actor },
      error: authenticationError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authenticationError || !actor) {
      return NextResponse.json({ error: "Your session is invalid. Sign in again." }, { status: 401 });
    }

    const { data: actorProfile, error: actorProfileError } =
      await supabaseAdmin
        .from("users")
        .select("role_id, user_roles(role_name)")
        .eq("id", actor.id)
        .single();

    if (actorProfileError || !actorProfile || !hasAdminRole(actorProfile)) {
      return NextResponse.json(
        { error: "Only an admin can assign staff roles." },
        { status: 403 }
      );
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from("users")
      .select("id, email, role_id, user_roles(role_name)")
      .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
      .maybeSingle();

    if (targetError) {
      console.error("Could not look up the staff role recipient:", targetError);
      return NextResponse.json(
        { error: "Could not look up that account." },
        { status: 500 }
      );
    }

    if (!target || target.email?.trim().toLowerCase() !== email) {
      return NextResponse.json(
        { error: "No account exists for that email address." },
        { status: 404 }
      );
    }

    const targetRole = target as unknown as UserRoleRecord & { id: string };
    if (hasAdminRole(targetRole)) {
      return NextResponse.json(
        { error: "Admin access cannot be changed here." },
        { status: 409 }
      );
    }

    const alreadyStaff =
      targetRole.role_id === 3 || hasRoleName(targetRole.user_roles, "staff");

    if (action === "grant" && alreadyStaff) {
      return NextResponse.json({ message: `${email} already has the staff role.` });
    }

    if (action === "revoke" && !alreadyStaff) {
      return NextResponse.json({ error: `${email} does not have staff access.` }, { status: 409 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ role_id: action === "grant" ? 3 : 1 })
      .eq("id", target.id);

    if (updateError) {
      console.error(`Could not ${action} staff access:`, updateError);
      return NextResponse.json(
        { error: `Could not ${action} staff access.` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message:
        action === "grant"
          ? `Staff role granted to ${email}. They can access the staff board after signing in.`
          : `Staff access revoked for ${email}. Their account remains active as a regular user.`,
    });
  } catch (error: unknown) {
    console.error("Staff access update failed:", error);
    return NextResponse.json(
      { error: "Staff access update failed. Please try again." },
      { status: 500 }
    );
  }
}
