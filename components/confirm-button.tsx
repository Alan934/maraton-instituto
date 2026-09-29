"use client";

/** Botón de envío que pide confirmación antes de ejecutar la acción del formulario. */
export function ConfirmButton({
  message, children, className = "btn btn-danger btn-sm", title,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      title={title}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
