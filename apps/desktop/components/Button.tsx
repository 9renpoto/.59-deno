import { JSX } from "preact";
import { IS_BROWSER } from "$fresh/runtime.ts";

export interface ButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  size?: "small" | "medium";
}

export function Button({
  variant = "primary",
  size = "medium",
  disabled,
  class: className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={!IS_BROWSER || disabled}
      class={`button-control${className ? ` ${className}` : ""}`}
      data-variant={variant}
      data-size={size}
    />
  );
}
