import React, { forwardRef } from "react";
import { cn } from "@/lib/utils"; // Ensure `cn` is a utility like `clsx`

import { cva } from "class-variance-authority"; // Keep this if still using `cva`

const glowVariants = cva("absolute w-full", {
  variants: {
    variant: {
      top: "top-0",
      above: "-top-[128px]",
      bottom: "bottom-0",
      below: "-bottom-[128px]",
      center: "top-[50%]",
    },
  },
  defaultVariants: {
    variant: "top",
  },
});

const Glow = forwardRef((props, ref) => {
  const { className, variant, ...rest } = props;

  return (
    <div ref={ref} className={cn(glowVariants({ variant }), className)} {...rest}>
      <div
        className={cn(
          "absolute left-1/2 h-[256px] w-[60%] -translate-x-1/2 scale-[2.5] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_#ffdaba_10%,_transparent_60%)] sm:h-[512px]",
        variant === "center" && "-translate-y-1/2",
      )}
      />
      <div
        className={cn(
          "absolute left-1/2 h-[128px] w-[40%] -translate-x-1/2 scale-[2] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_#fad3ac_10%,_transparent_70%)] sm:h-[256px]",
        variant === "center" && "-translate-y-1/2",
      )}
      />
    </div>
  );
});

Glow.displayName = "Glow";

export { Glow };
