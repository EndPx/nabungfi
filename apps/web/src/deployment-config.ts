/** Validate only the public build configuration; never import server environment files. */
export function validateVercelBuild(input: {
  vercel?: string;
  appId?: string;
  apiOrigin?: string;
}): void {
  if (input.vercel !== "1") return;
  if (!input.appId?.trim())
    throw new Error(
      "Set the public VITE_PRIVY_APP_ID before deploying the Vercel frontend.",
    );
  let origin: URL;
  try {
    origin = new URL(input.apiOrigin ?? "");
  } catch {
    throw new Error(
      "Set VITE_API_ORIGIN to the HTTPS backend origin before deploying to Vercel.",
    );
  }
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error(
      "VITE_API_ORIGIN must be an HTTPS origin without a path, query, fragment or credentials.",
    );
}
