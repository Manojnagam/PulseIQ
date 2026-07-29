import * as React from "react";
import { cn } from "@/lib/utils";

export interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
}

export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = "#ffffff",
      shimmerSize = "0.05em",
      shimmerDuration = "3s",
      borderRadius = "100px",
      background = "rgba(39, 174, 96, 1)",
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        style={
          {
            "--shimmer-color": shimmerColor,
            "--radius": borderRadius,
            "--speed": shimmerDuration,
            "--cut": shimmerSize,
            "--bg": background,
          } as React.CSSProperties
        }
        className={cn(
          "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden font-medium text-white px-6 py-3 whitespace-nowrap rounded-xl shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",
          className
        )}
        ref={ref}
        {...props}
      >
        {/* Shimmer Border */}
        <div
          className={cn(
            "-z-30 absolute inset-0 overflow-visible [container-type:size]"
          )}
        >
          <div className="absolute inset-0 h-[100cqh] animate-shimmer [aspect-ratio:1] [border-radius:0] [mask:none]">
            <div className="absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_0deg,transparent_0_340deg,var(--shimmer-color)_360deg)]" />
          </div>
        </div>

        {/* Content */}
        {children}

        {/* Backdrop Glow */}
        <div
          className={cn(
            "-z-20 absolute inset-[1px] rounded-xl bg-pulseGreen-600 dark:bg-pulseGreen-700 transition-all duration-300 group-hover:bg-pulseGreen-500"
          )}
        />
      </button>
    );
  }
);

ShimmerButton.displayName = "ShimmerButton";
