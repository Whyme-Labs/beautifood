import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

loadFont({ family: "Figtree", url: staticFile("fonts/figtree.woff2"), weight: "300 900" });
loadFont({ family: "Big Shoulders", url: staticFile("fonts/bigshoulders-800.woff2"), weight: "800" });

export const C = {
  sun: "#ffd12e",
  sunSoft: "#fff4c2",
  ink: "#1a1814",
  ink2: "#4a443a",
  paper: "#fffdf7",
  rose: "#ff9db2",
  mint: "#84dec2",
  lilac: "#c1b0ff",
};
export const SANS = "Figtree, 'PingFang SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif";
export const NUM = "'Big Shoulders', Figtree, sans-serif";
