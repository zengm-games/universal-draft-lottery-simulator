// Chrome ?, Firefox 148, Safari ?
type IterValue<T> = T extends Iterable<infer U> ? U : T extends Iterator<infer U> ? U : never;
type ZipValues<T extends readonly unknown[]> = {
	[K in keyof T]: IterValue<T[K]>;
};
declare global {
	interface IteratorConstructor {
		zip<const T extends readonly Iterable<unknown>[]>(
			iterables: T,
			options?: {
				mode: "shortest" | "strict";
			},
		): IterableIterator<ZipValues<T>>;
	}
}
if (typeof Iterator === "undefined" || Iterator == null) {
	(globalThis as any).Iterator = {};
}
if (!Iterator.zip) {
	Iterator.zip = (iterables, options) => {
		const mode = options?.mode ?? "shortest";
		const iters = iterables.map((iterable) => iterable[Symbol.iterator]());

		if (iters.length === 0) {
			return {
				next() {
					return {
						value: undefined,
						done: true,
					};
				},
				[Symbol.iterator]() {
					return this;
				},
			};
		}

		return {
			next() {
				let done = false;
				let strictError = false;
				const value = [];
				for (const [i, iter] of iters.entries()) {
					const result = iter.next();
					if (result.done) {
						done = true;
						break;
					} else {
						value[i] = result.value;
					}
				}

				if (done) {
					// Extra pass to close all and handle strict errors
					if (mode === "shortest") {
						for (const [i, iter] of iters.entries()) {
							// We know the one that was done is already closed
							if (i !== value.length) {
								iter.return?.();
							}
						}
					} else {
						for (const [i, iter] of iters.entries()) {
							if (i < value.length) {
								// Iterator was not done if there is an entry in value, this is an error!
								strictError = true;
								iter.return?.();
							} else if (i === value.length) {
								// We know the one that was done is already closed
							} else {
								// Make sure any subsequent iterators are done too at the same time, if not it's an error
								const result = iter.next();
								if (!result.done) {
									iter.return?.();
									strictError = true;
								}
							}
						}
					}
				}

				if (strictError) {
					throw new TypeError("Iterables do not have the same length");
				}

				if (done) {
					return { done: true, value: undefined };
				} else {
					return { done: false, value };
				}
			},
			return(value?: unknown) {
				for (const iter of iters) {
					iter.return?.();
				}
				return { value, done: true };
			},
			throw(error?: unknown) {
				for (const iter of iters) {
					iter.throw?.(error);
				}
				throw error;
			},
			[Symbol.iterator]() {
				return this;
			},
		} as any;
	};
}
