import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 uppercase tracking-widest text-[9px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-gold text-void shadow",
        secondary: "border-transparent bg-void-3 text-cream",
        destructive: "border-transparent bg-rose/20 text-rose border-rose/50",
        verified: "border-transparent bg-teal/20 text-teal border-teal/50",
        outline: "text-cream border-line",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
