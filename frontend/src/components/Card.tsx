import React from "react";
import cx from "classnames";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  return (
    <div
      className={cx(
        "border-3 border-black bg-white p-6 shadow-[6px_6px_0_0_#000] relative",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
