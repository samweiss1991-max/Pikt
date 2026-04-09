interface LogoProps {
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-5xl",
};

export function Logo({ size = "md" }: LogoProps) {
  return (
    <span className={`${sizeClasses[size]} font-serif tracking-tight`}>
      pick<span className="italic text-accent-green">t</span>
    </span>
  );
}
