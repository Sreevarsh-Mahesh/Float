import React from "react";
import cx from "classnames";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "dark" | "default";
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "default",
  fullWidth = false,
  className,
  ...props
}) => {
  const baseClass = "neo-button";
  let variantClass = "";

  switch (variant) {
    case "primary":
      variantClass = "neo-button-primary";
      break;
    case "secondary":
      variantClass = "neo-button-secondary";
      break;
    case "accent":
      variantClass = "neo-button-accent";
      break;
    case "dark":
      variantClass = "neo-button-dark";
      break;
    default:
      variantClass = "bg-white text-black";
      break;
  }

  const widthClass = fullWidth ? "w-full" : "w-auto";

  return (
    <button className={cx(baseClass, variantClass, widthClass, className)} {...props}>
      {children}
    </button>
  );
};
