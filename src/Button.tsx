import type { ComponentChildren } from "preact";

export const Button = ({
	children,
	className,
	disabled,
	onClick,
	outline,
	variant,
}: {
	children: ComponentChildren;
	className?: string;
	disabled?: boolean;
	onClick: () => void;
	outline?: boolean;
	variant: "danger" | "primary" | "success";
}) => {
	let colorClasses;
	if (variant === "primary") {
		colorClasses = "enabled:hover:bg-blue-500 text-blue-600 border-blue-600";
	} else if (variant === "danger") {
		colorClasses = "enabled:hover:bg-red-500 text-red-600 border-red-600";
	} else if (variant === "success") {
		if (!outline) {
			colorClasses = "enabled:hover:bg-green-700 text-white bg-green-600";
		}
	}

	return (
		<button
			className={`${
				outline ? "bg-transparent " : ""
			}enabled:hover:text-white py-2 px-3 border enabled:hover:border-transparent rounded disabled:opacity-50 ${colorClasses}${
				className ? ` ${className}` : ""
			}`}
			disabled={disabled}
			onClick={onClick}
			type="button"
		>
			{children}
		</button>
	);
};
