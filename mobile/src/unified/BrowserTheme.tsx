import React, { useContext } from "react";
import { Platform } from "react-native";
import { Theme } from "./ui";

/** Apply the active palette to browser scrollbars and system controls without affecting native layout. */
export function BrowserTheme({ scheme }: { scheme: "dark" | "light" }) {
  const c = useContext(Theme);
  if (Platform.OS !== "web") return null;
  return React.createElement("style", null, `
    :root { color-scheme: ${scheme}; }
    * { scrollbar-color: ${c.dim} ${c.panel}; scrollbar-width: thin; }
    *::-webkit-scrollbar { width: 10px; height: 10px; }
    *::-webkit-scrollbar-track, *::-webkit-scrollbar-corner { background: ${c.panel}; }
    *::-webkit-scrollbar-thumb { background: ${c.dim}; border: 2px solid ${c.panel}; border-radius: 999px; }
    *::-webkit-scrollbar-thumb:hover { background: ${c.muted}; }
  `);
}
