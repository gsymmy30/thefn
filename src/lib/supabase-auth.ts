type SupabaseAuthError = {
  message?: string;
  error_description?: string;
  msg?: string;
};

type SupabaseVerifyResponse = {
  user?: {
    email?: string | null;
  } | null;
};

type SupabaseUserResponse = {
  email?: string | null;
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error("Supabase auth environment is not configured");
  }

  return { url, anonKey };
}

async function parseSupabaseError(response: Response) {
  let payload: SupabaseAuthError | undefined;
  try {
    payload = (await response.json()) as SupabaseAuthError;
  } catch {
    payload = undefined;
  }

  return (
    payload?.message ||
    payload?.error_description ||
    payload?.msg ||
    `Supabase auth request failed (${response.status})`
  );
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function sendSupabaseMagicLink(email: string, redirectTo: string) {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetchWithTimeout(`${url}/auth/v1/otp`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      create_user: true,
      should_create_user: true,
      email_redirect_to: redirectTo,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseSupabaseError(response));
  }
}

export async function verifySupabaseMagicLink(tokenHash: string, type: string) {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetchWithTimeout(`${url}/auth/v1/verify`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token_hash: tokenHash,
      type,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseSupabaseError(response));
  }

  const payload = (await response.json()) as SupabaseVerifyResponse;
  const email = payload.user?.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("Unable to resolve verified email");
  }

  return { email };
}

export async function getSupabaseEmailFromAccessToken(accessToken: string) {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetchWithTimeout(`${url}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseSupabaseError(response));
  }

  const payload = (await response.json()) as SupabaseUserResponse;
  const email = payload.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("Unable to resolve verified email");
  }

  return { email };
}
