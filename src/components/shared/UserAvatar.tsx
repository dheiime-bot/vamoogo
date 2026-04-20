import { Smile, Car as CarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  role?: "passenger" | "driver";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  xs: "h-8 w-8 text-xs",
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};

const iconSizeMap: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  xs: "h-4 w-4",
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

/**
 * Miniatura forçada do usuário.
 * - Se `src` (selfie) existir, exibe a selfie em formato circular.
 * - Se NÃO existir, exibe um avatar padrão por papel:
 *   passageiro = ícone de sorriso, motorista = ícone de carro.
 */
const UserAvatar = ({ src, name, role = "passenger", size = "md", className }: UserAvatarProps) => {
  const Icon = role === "driver" ? CarIcon : Smile;
  const dim = sizeMap[size];
  const iconDim = iconSizeMap[size];

  if (src) {
    return (
      <img
        src={src}
        alt={name || "Avatar"}
        className={cn(
          dim,
          "rounded-full object-cover shrink-0 border border-border bg-muted",
          className,
        )}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn(
        dim,
        "rounded-full shrink-0 flex items-center justify-center bg-gradient-primary text-primary-foreground border border-border",
        className,
      )}
      aria-label={name || "Avatar padrão"}
    >
      <Icon className={iconDim} />
    </div>
  );
};

export default UserAvatar;