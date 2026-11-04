import type { CompanionClient, User } from "../client";
export type GoogleButtonProps = { client: CompanionClient; remember: boolean; disabled: boolean; onBusyChange: (busy: boolean) => void; onLoggedIn: (user: User) => Promise<void> };
/** Native sign-in continues using the platform password flow. */
export function GoogleButton(_props: GoogleButtonProps) { return null; }
