import { ButtonHTMLAttributes } from "react";
type V = "primary" | "secondary" | "ghost";
export default function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: V }) {
  const cls = variant === "primary" ? "btn-primary" : variant === "secondary" ? "btn-secondary" : "btn-ghost";
  return <button className={`${cls} ${className}`} {...p} />;
}
