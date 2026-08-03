-- DD6-R02: purpose/destination/session-bound handoff tokens. A token minted for the WebView
-- bridge can no longer be exchanged for a browser session and vice versa; the browser destination
-- is bound at mint; the minting device's session revocation is re-checkable at exchange.
ALTER TABLE "NativeAuthToken"
  ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'WEBVIEW_BRIDGE',
  ADD COLUMN "destination" TEXT,
  ADD COLUMN "mobileSessionFamilyId" TEXT;

-- DD6-R03: atomic TTS quota reservation state.
ALTER TYPE "AiRequestStatus" ADD VALUE 'PENDING';
