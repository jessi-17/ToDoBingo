import Image, { type StaticImageData } from "next/image";

import circleItBack from "../../public/icons/sidebar/circle-it-back.png";
import eraser from "../../public/icons/sidebar/eraser.png";
import pencil from "../../public/icons/sidebar/pencil.png";
import profile from "../../public/icons/sidebar/profile.png";
import quote from "../../public/icons/sidebar/quote.png";
import stickers from "../../public/icons/sidebar/stickers.png";
import todolist from "../../public/icons/sidebar/todolist.png";
import {
  bodyFont,
  panelClass,
  panelStyle,
  s,
  scaleVars,
  sheetScaleVars,
  TOOLBAR_UNITS,
} from "./figma-scale";

/**
 * Tool rail from the "To-do-List" Figma frame (node 61:350). Every dimension is
 * the literal Figma value scaled by `--s`.
 */
export type ToolName =
  | "Pencil"
  | "Eraser"
  | "Stickers"
  | "Todolist"
  | "Circle it back"
  | "Quote"
  | "Profile";

type Tool = {
  label: ToolName;
  icon: StaticImageData;
  /** Rendered icon size in artboard px. Defaults to the 48x48 slot. */
  width?: number;
  height?: number;
  /** Gap between icon and label. Figma uses 0 except where noted. */
  gap?: number;
  /** Label line-height in artboard px. */
  leading?: number;
  /** Art that overflows its slot, anchored to the slot's bottom edge. */
  overflows?: boolean;
};

const tools: Tool[] = [
  { label: "Pencil", icon: pencil },
  { label: "Eraser", icon: eraser },
  { label: "Stickers", icon: stickers, width: 52, height: 61, overflows: true },
  { label: "Todolist", icon: todolist },
  {
    label: "Circle it back",
    icon: circleItBack,
    height: 46,
    gap: 4,
    leading: 12,
  },
  { label: "Quote", icon: quote },
  { label: "Profile", icon: profile },
];

export default function Sidebar({
  className = "",
  onToolClick,
  horizontal = false,
}: {
  className?: string;
  onToolClick?: (tool: ToolName) => void;
  /** The portrait layout's bottom toolbar instead of the desktop rail. */
  horizontal?: boolean;
}) {
  return (
    <nav
      aria-label="Tools"
      style={{
        ...(horizontal ? sheetScaleVars(TOOLBAR_UNITS, 0.97) : scaleVars),
        ...panelStyle,
        ...(horizontal
          ? { paddingBlock: s(10), paddingInline: s(16), columnGap: s(10) }
          : {
              width: s(90),
              paddingBlock: s(36),
              paddingInline: s(16),
              rowGap: s(24),
            }),
        fontFamily: bodyFont,
      }}
      className={`flex items-center ${horizontal ? "flex-row" : "flex-col"} ${panelClass} ${className}`}
    >
      {tools.map(
        ({ label, icon, width = 48, height = 48, gap, leading, overflows }) => (
          <button
            key={label}
            type="button"
            onClick={() => onToolClick?.(label)}
            style={{ width: s(58), rowGap: gap ? s(gap) : undefined }}
            className="flex cursor-pointer flex-col items-center transition-transform hover:scale-105 active:scale-95"
          >
            <span
              style={{ width: s(48), height: s(48) }}
              className="relative flex items-end justify-center"
            >
              <Image
                src={icon}
                alt=""
                width={width}
                height={height}
                style={{ width: s(width), height: s(height) }}
                className={
                  overflows ? "absolute bottom-0 left-0 max-w-none" : ""
                }
              />
            </span>

            <span
              style={{ fontSize: s(14), lineHeight: s(leading ?? 17) }}
              className="w-full text-center text-black"
            >
              {label}
            </span>
          </button>
        ),
      )}
    </nav>
  );
}
